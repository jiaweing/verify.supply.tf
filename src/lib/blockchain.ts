import * as schema from "@/db/schema";
import { createHash } from "crypto";
import { asc, eq, inArray, type InferModel } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";

export type DbBlock = InferModel<typeof schema.blocks>;
export type DbTransaction = InferModel<typeof schema.transactions>;
export type Database = PostgresJsDatabase<typeof schema>;

function normalizeTimestamp(timestamp: string): string {
  // Ensure consistent millisecond precision by truncating to 3 decimal places
  const date = new Date(timestamp);
  return date.toISOString().replace(/\.\d+Z$/, ".000Z");
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

export function hash(data: unknown): string {
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
      blockchainVersion: string;
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
          // Hash pair of nodes using JSON stringification for consistent ordering
          const combined = JSON.stringify([
            currentLayer[i],
            currentLayer[i + 1],
          ]);
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
      // Use the same JSON stringification approach as in buildTree
      const combined = isLeft
        ? JSON.stringify([currentHash, proofElement])
        : JSON.stringify([proofElement, currentHash]);
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
    this.transactions = transactions.map((tx) => ({
      ...tx,
      timestamp: normalizeTimestamp(tx.timestamp),
    }));
    this.merkleTree = new MerkleTree(this.transactions);

    this.data = {
      blockNumber,
      timestamp: normalizeTimestamp(timestamp),
      previousHash,
      merkleRoot: this.merkleTree.getRoot(),
      nonce,
    };
  }

  public calculateHash(): string {
    return hash(stableStringify(this.data));
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

    // For single-transaction blocks, the merkle root is the transaction hash
    if (this.transactions.length === 1) {
      return this.merkleTree.getRoot() === this.data.merkleRoot;
    }

    // For multiple transactions, verify using merkle proof
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

// Get all blocks in the blockchain with their transactions
async function getAllBlocksAndTransactions(
  db: Database,
  itemId: string
): Promise<{
  blocks: DbBlock[];
  transactions: Map<number, DbTransaction[]>;
  itemTransactions: DbTransaction[];
}> {
  // Get ALL blocks from the start of the blockchain
  const allBlocks = await db.query.blocks.findMany({
    orderBy: [asc(schema.blocks.blockNumber)],
  });

  if (allBlocks.length === 0) {
    return { blocks: [], transactions: new Map(), itemTransactions: [] };
  }

  // Get transactions for ALL blocks
  const blockTransactions = await db.query.transactions.findMany({
    where: inArray(
      schema.transactions.blockId,
      allBlocks.map((b) => b.id)
    ),
    orderBy: [asc(schema.transactions.timestamp)],
  });

  // Filter out just the item's transactions (for item data verification)
  const itemTransactions = blockTransactions.filter(
    (tx) => tx.itemId === itemId
  );

  // Group all transactions by block
  const transactionsByBlock = new Map<number, DbTransaction[]>();
  for (const block of allBlocks) {
    transactionsByBlock.set(
      block.id,
      blockTransactions.filter((tx) => tx.blockId === block.id)
    );
  }

  return {
    blocks: allBlocks,
    transactions: transactionsByBlock,
    itemTransactions,
  };
}

export async function verifyItemChain(
  db: Database,
  itemId: string
): Promise<{ isValid: boolean; error?: string }> {
  const {
    blocks,
    transactions: transactionsByBlock,
    itemTransactions,
  } = await getAllBlocksAndTransactions(db, itemId);

  if (blocks.length === 0) {
    return { isValid: false, error: "No blocks found in blockchain" };
  }

  // Verify the entire blockchain integrity from genesis block
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockTransactions = transactionsByBlock.get(block.id) || [];

    if (blockTransactions.length === 0) {
      return {
        isValid: false,
        error: `No transactions found in block ${block.blockNumber}`,
      };
    }

    // Normalize timestamps for consistent hashing
    const normalizedBlock = {
      ...block,
      timestamp: normalizeTimestamp(block.timestamp.toISOString()),
    };

    const normalizedTransactions = blockTransactions.map((tx) => ({
      ...tx,
      timestamp: normalizeTimestamp(tx.timestamp.toISOString()),
      data: {
        ...(tx.data as TransactionData),
        timestamp: normalizeTimestamp((tx.data as TransactionData).timestamp),
      },
    }));

    // Create Block instance for verification
    const blockInstance = new Block(
      normalizedBlock.blockNumber,
      normalizedBlock.previousHash,
      normalizedTransactions.map((tx) => tx.data as TransactionData),
      normalizedBlock.timestamp,
      normalizedBlock.nonce
    );

    // Verify block hash
    const computedHash = blockInstance.calculateHash();
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
      if (block.previousHash !== blocks[i - 1].hash) {
        return {
          isValid: false,
          error: `Broken chain link at block ${block.blockNumber}`,
        };
      }
    }

    // Verify all transactions in this block
    for (let txIndex = 0; txIndex < blockTransactions.length; txIndex++) {
      const isValidTx = blockInstance.verifyTransaction(txIndex);
      if (!isValidTx) {
        return {
          isValid: false,
          error: `Invalid transaction ${blockTransactions[txIndex].id} in block ${block.blockNumber}`,
        };
      }
    }
  }

  // Verify the specific item's data if it exists in the chain
  if (itemTransactions.length === 0) {
    return { isValid: false, error: "No transactions found for item" };
  }

  const item = await db.query.items.findFirst({
    where: eq(schema.items.id, itemId),
  });

  if (!item) {
    return { isValid: false, error: "Item not found" };
  }

  // Verify item data matches latest transaction
  const latestTx = itemTransactions[itemTransactions.length - 1];
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
    item.blockchainVersion === latestTxData.data.item.blockchainVersion &&
    item.globalKeyVersion === latestTxData.data.item.globalKeyVersion &&
    item.nfcLink === latestTxData.data.item.nfcLink;

  if (!itemMatches) {
    return {
      isValid: false,
      error: "Current item data does not match blockchain record",
    };
  }

  // All blockchain integrity and item data checks passed
  return { isValid: true };
}
