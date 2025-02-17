import * as schema from "@/db/schema";
import { createHash } from "crypto";
import { asc, eq, type InferModel } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";

export type DbBlock = InferModel<typeof schema.blocks>;
export type DbTransaction = InferModel<typeof schema.transactions>;
export type Database = PostgresJsDatabase<typeof schema>;

function stableStringify(obj: unknown): string {
  if (typeof obj !== "object" || obj === null) {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj).sort();
  const items = sortedKeys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
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
  };
}

export interface TransactionHistoryItem extends DbTransaction {
  block?: DbBlock;
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
      timestamp,
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
  const transactions = await getItemTransactionHistory(db, itemId);

  if (transactions.length === 0) {
    return { isValid: false, error: "No transactions found for item" };
  }

  // Verify transaction sequence
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

  return { isValid: true };
}
