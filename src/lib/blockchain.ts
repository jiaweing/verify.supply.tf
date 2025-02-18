import * as schema from "@/db/schema";
import { createHash } from "crypto";
import { asc, eq, type InferModel } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";

export type DbBlock = InferModel<typeof schema.blocks>;
export type DbTransaction = InferModel<typeof schema.transactions>;
export type Database = PostgresJsDatabase<typeof schema>;

function normalizeTimestamp(timestamp: string): string {
  // Ensure consistent millisecond precision by truncating to 3 decimal places
  const date = new Date(timestamp);
  return date.toISOString().replace(/\.\d+/, ".000");
}

function stableStringify(obj: unknown): string {
  if (typeof obj !== "object" || obj === null) {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }

  // Special handling for Date objects
  if (obj instanceof Date) {
    return `"${normalizeTimestamp(obj.toISOString())}"`;
  }

  const sortedKeys = Object.keys(obj).sort();
  const items = sortedKeys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
    // Handle timestamp strings
    if (typeof value === "string" && key === "timestamp") {
      return `"${key}":"${normalizeTimestamp(value)}"`;
    }
    return `"${key}":${stableStringify(value)}`;
  });
  return "{" + items.join(",") + "}";
}

function hash(data: unknown): string {
  return createHash("sha256").update(stableStringify(data)).digest("hex");
}

// Block chain data types
export interface BlockData {
  blockNumber: number;
  timestamp: string;
  previousHash: string;
  merkleRoot: string;
  nonce: number;
}

export interface TransactionData {
  type: "create" | "transfer";
  itemId: string;
  timestamp: string;
  data: {
    from?: {
      name: string;
      email: string;
    };
    to: {
      name: string;
      email: string;
    };
    item: {
      id: string;
      serialNumber: string;
      sku: string;
      mintNumber: string;
      weight: string;
      nfcSerialNumber: string;
      orderId: string;
      originalOwnerName: string;
      originalOwnerEmail: string;
      originalPurchaseDate: Date;
      purchasedFrom: string;
      manufactureDate: Date;
      producedAt: string;
      createdAt: Date;
      itemEncryptionKeyHash: string;
      globalKeyVersion: string;
      nfcLink: string;
    };
  };
}

export interface TransactionHistoryItem extends Omit<DbTransaction, "block"> {
  block: DbBlock | null;
}

export interface ItemOwnership {
  currentOwnerName: string;
  currentOwnerEmail: string;
  lastTransferDate: Date;
  transferCount?: number;
}

export function getCurrentOwner(
  transactions: TransactionHistoryItem[],
  item: {
    originalOwnerName: string;
    originalOwnerEmail: string;
    createdAt: Date;
  }
): ItemOwnership {
  // Sort transactions by timestamp to get the latest
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Find the latest transfer transaction
  const latestTransfer = sortedTransactions.find(
    (tx) => tx.transactionType === "transfer"
  );

  if (latestTransfer) {
    const txData = latestTransfer.data as TransactionData;
    return {
      currentOwnerName: txData.data.to.name,
      currentOwnerEmail: txData.data.to.email,
      lastTransferDate: latestTransfer.timestamp,
      transferCount: sortedTransactions.filter(
        (tx) => tx.transactionType === "transfer"
      ).length,
    };
  }

  // If no transfers, return original owner
  return {
    currentOwnerName: item.originalOwnerName,
    currentOwnerEmail: item.originalOwnerEmail,
    lastTransferDate: item.createdAt,
    transferCount: 0,
  };
}

export class MerkleTree {
  private leaves: string[];
  private layers: string[][];

  constructor(transactions: TransactionData[]) {
    // Create leaf hashes from transactions
    this.leaves = transactions.map((tx) => hash(tx));
    this.layers = [this.leaves];

    // Build tree layers
    this.buildTree();
  }

  private buildTree() {
    while (this.layers[this.layers.length - 1].length > 1) {
      const currentLayer = this.layers[this.layers.length - 1];
      const newLayer: string[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          // Hash pair of nodes
          const combined = currentLayer[i] + currentLayer[i + 1];
          newLayer.push(hash(combined));
        } else {
          // Odd number of nodes, promote single node
          newLayer.push(currentLayer[i]);
        }
      }

      this.layers.push(newLayer);
    }
  }

  public getRoot(): string {
    return this.layers[this.layers.length - 1][0];
  }

  public getProof(index: number): string[] {
    const proof: string[] = [];
    let currentIndex = index;

    for (let i = 0; i < this.layers.length - 1; i++) {
      const currentLayer = this.layers[i];
      const isLeft = currentIndex % 2 === 0;
      const pairIndex = isLeft ? currentIndex + 1 : currentIndex - 1;

      if (pairIndex < currentLayer.length) {
        proof.push(currentLayer[pairIndex]);
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  public static verify(
    leaf: string,
    proof: string[],
    root: string,
    index: number
  ): boolean {
    let currentHash = leaf;
    let currentIndex = index;

    for (const proofElement of proof) {
      const isLeft = currentIndex % 2 === 0;
      const combined = isLeft
        ? currentHash + proofElement
        : proofElement + currentHash;
      currentHash = hash(combined);
      currentIndex = Math.floor(currentIndex / 2);
    }

    return currentHash === root;
  }
}

export class Block {
  private readonly data: BlockData;
  private readonly transactions: TransactionData[];
  private readonly merkleTree: MerkleTree;

  constructor(
    blockNumber: number,
    previousHash: string,
    transactions: TransactionData[],
    timestamp = new Date().toISOString(),
    nonce = 0
  ) {
    this.transactions = transactions;
    this.merkleTree = new MerkleTree(transactions);

    this.data = {
      blockNumber,
      timestamp: normalizeTimestamp(timestamp),
      previousHash,
      merkleRoot: this.merkleTree.getRoot(),
      nonce,
    };
  }

  public calculateHash(): string {
    return hash(this.data);
  }

  public getData(): BlockData {
    return this.data;
  }

  public getTransactions(): TransactionData[] {
    return this.transactions;
  }

  public getMerkleTree(): MerkleTree {
    return this.merkleTree;
  }

  public verifyTransaction(transactionIndex: number): boolean {
    const transaction = this.transactions[transactionIndex];
    if (!transaction) return false;

    const transactionHash = hash(transaction);
    const proof = this.merkleTree.getProof(transactionIndex);
    return MerkleTree.verify(
      transactionHash,
      proof,
      this.data.merkleRoot,
      transactionIndex
    );
  }

  public static verifyChain(blocks: Block[]): boolean {
    for (let i = 1; i < blocks.length; i++) {
      const currentBlock = blocks[i];
      const previousBlock = blocks[i - 1];

      // Verify block link
      if (
        currentBlock.getData().previousHash !== previousBlock.calculateHash()
      ) {
        return false;
      }

      // Verify block number sequence
      if (
        currentBlock.getData().blockNumber !==
        previousBlock.getData().blockNumber + 1
      ) {
        return false;
      }
    }

    return true;
  }
}

export async function getItemTransactionHistory(
  db: Database,
  itemId: string
): Promise<TransactionHistoryItem[]> {
  const transactions = await db.query.transactions.findMany({
    where: eq(schema.transactions.itemId, itemId),
    with: {
      block: true,
    },
    orderBy: [asc(schema.transactions.timestamp)],
  });

  return transactions as TransactionHistoryItem[];
}

export async function verifyItemChain(
  db: Database,
  itemId: string
): Promise<{ isValid: boolean; error?: string }> {
  const item = await db.query.items.findFirst({
    where: (items, { eq }) => eq(items.id, itemId),
    with: {
      latestTransaction: true,
    },
  });

  if (!item) {
    return { isValid: false, error: "Item not found" };
  }

  const transactions = await getItemTransactionHistory(db, itemId);

  if (transactions.length === 0) {
    return { isValid: false, error: "No transactions found for item" };
  }

  // First verify the blockchain integrity
  // Then verify transaction sequence and chain links
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    const block = transaction.block;

    if (!block) {
      return {
        isValid: false,
        error: `Missing block for transaction ${transaction.id}`,
      };
    }

    // Create Block instance for verification
    const blockInstance = new Block(
      block.blockNumber,
      block.previousHash,
      [transaction.data as TransactionData],
      block.timestamp.toISOString(), // Use the exact timestamp from the block
      block.nonce
    );

    // Verify block hash
    const computedHash = blockInstance.calculateHash();
    // Log with detailed timestamp info for debugging
    console.log(`Block ${block.blockNumber} verification:`, {
      storedHash: block.hash,
      computedHash,
      blockData: blockInstance.getData(),
      nonce: block.nonce,
      storedTimestamp: block.timestamp.toISOString(),
      blockDataTimestamp: blockInstance.getData().timestamp,
      storedTimestampMs: block.timestamp.getTime(),
      blockDataTimestampMs: new Date(
        blockInstance.getData().timestamp
      ).getTime(),
    });

    if (computedHash !== block.hash) {
      return {
        isValid: false,
        error: `Invalid block hash at block ${block.blockNumber} (stored: ${block.hash}, computed: ${computedHash})`,
      };
    }

    // Verify merkle root
    if (blockInstance.getMerkleTree().getRoot() !== block.merkleRoot) {
      return {
        isValid: false,
        error: `Invalid merkle root at block ${block.blockNumber}`,
      };
    }

    // Verify chain link (except genesis block)
    if (i > 0) {
      const previousBlock = transactions[i - 1].block;
      if (!previousBlock) {
        return {
          isValid: false,
          error: `Missing previous block at block ${block.blockNumber}`,
        };
      }

      if (block.previousHash !== previousBlock.hash) {
        return {
          isValid: false,
          error: `Broken chain link at block ${block.blockNumber}`,
        };
      }
    }
  }

  // Verify item data matches latest transaction
  const latestTx = transactions[transactions.length - 1];
  if (!latestTx) {
    return { isValid: false, error: "No transactions found for item" };
  }
  const latestTxData = latestTx.data as TransactionData;

  // The actual item data should match what's recorded in the latest transaction
  const itemMatches =
    item.id === latestTxData.data.item.id &&
    item.serialNumber === latestTxData.data.item.serialNumber &&
    item.sku === latestTxData.data.item.sku &&
    item.mintNumber === latestTxData.data.item.mintNumber &&
    item.weight === latestTxData.data.item.weight &&
    item.nfcSerialNumber === latestTxData.data.item.nfcSerialNumber &&
    item.orderId === latestTxData.data.item.orderId &&
    item.originalOwnerName === latestTxData.data.item.originalOwnerName &&
    item.originalOwnerEmail === latestTxData.data.item.originalOwnerEmail &&
    item.originalPurchaseDate.getTime() ===
      new Date(latestTxData.data.item.originalPurchaseDate).getTime() &&
    item.purchasedFrom === latestTxData.data.item.purchasedFrom &&
    item.manufactureDate.getTime() ===
      new Date(latestTxData.data.item.manufactureDate).getTime() &&
    item.producedAt === latestTxData.data.item.producedAt &&
    item.createdAt.getTime() ===
      new Date(latestTxData.data.item.createdAt).getTime() &&
    item.itemEncryptionKeyHash ===
      latestTxData.data.item.itemEncryptionKeyHash &&
    item.globalKeyVersion === latestTxData.data.item.globalKeyVersion &&
    item.nfcLink === latestTxData.data.item.nfcLink;

  // debug each item match 1 by 1
  console.log(
    "item.id",
    item.id,
    latestTxData.data.item.id,
    item.id === latestTxData.data.item.id
  );
  console.log(
    "item.serialNumber",
    item.serialNumber,
    latestTxData.data.item.serialNumber,
    item.serialNumber === latestTxData.data.item.serialNumber
  );
  console.log(
    "item.sku",
    item.sku,
    latestTxData.data.item.sku,
    item.sku === latestTxData.data.item.sku
  );
  console.log(
    "item.mintNumber",
    item.mintNumber,
    latestTxData.data.item.mintNumber,
    item.mintNumber === latestTxData.data.item.mintNumber
  );
  console.log(
    "item.weight",
    item.weight,
    latestTxData.data.item.weight,
    item.weight === latestTxData.data.item.weight
  );
  console.log(
    "item.nfcSerialNumber",
    item.nfcSerialNumber,
    latestTxData.data.item.nfcSerialNumber,
    item.nfcSerialNumber === latestTxData.data.item.nfcSerialNumber
  );
  console.log(
    "item.orderId",
    item.orderId,
    latestTxData.data.item.orderId,
    item.orderId === latestTxData.data.item.orderId
  );
  console.log(
    "item.originalOwnerName",
    item.originalOwnerName,
    latestTxData.data.item.originalOwnerName,
    item.originalOwnerName === latestTxData.data.item.originalOwnerName
  );
  console.log(
    "item.originalOwnerEmail",
    item.originalOwnerEmail,
    latestTxData.data.item.originalOwnerEmail,
    item.originalOwnerEmail === latestTxData.data.item.originalOwnerEmail
  );
  console.log(
    "item.originalPurchaseDate",
    item.originalPurchaseDate,
    latestTxData.data.item.originalPurchaseDate,
    item.originalPurchaseDate === latestTxData.data.item.originalPurchaseDate
  );
  console.log(
    "item.purchasedFrom",
    item.purchasedFrom,
    latestTxData.data.item.purchasedFrom,
    item.purchasedFrom === latestTxData.data.item.purchasedFrom
  );
  console.log(
    "item.manufactureDate",
    item.manufactureDate,
    latestTxData.data.item.manufactureDate,
    item.manufactureDate === latestTxData.data.item.manufactureDate
  );
  console.log(
    "item.producedAt",
    item.producedAt,
    latestTxData.data.item.producedAt,
    item.producedAt === latestTxData.data.item.producedAt
  );
  console.log(
    "item.createdAt",
    item.createdAt,
    latestTxData.data.item.createdAt,
    item.createdAt === latestTxData.data.item.createdAt
  );
  console.log(
    "item.itemEncryptionKeyHash",
    item.itemEncryptionKeyHash,
    latestTxData.data.item.itemEncryptionKeyHash,
    item.itemEncryptionKeyHash === latestTxData.data.item.itemEncryptionKeyHash
  );
  console.log(
    "item.globalKeyVersion",
    item.globalKeyVersion,
    latestTxData.data.item.globalKeyVersion,
    item.globalKeyVersion === latestTxData.data.item.globalKeyVersion
  );
  console.log(
    "item.nfcLink",
    item.nfcLink,
    latestTxData.data.item.nfcLink,
    item.nfcLink === latestTxData.data.item.nfcLink
  );

  if (!itemMatches) {
    return {
      isValid: false,
      error: "Current item data does not match blockchain record",
    };
  }

  // All blockchain integrity and item data checks passed
  return { isValid: true };
}
