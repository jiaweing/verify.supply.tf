import { InferSelectModel, relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Short URLs table
export const shortUrls = pgTable("short_urls", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalUrl: varchar("original_url", { length: 255 }).notNull(),
  shortPath: uuid("short_path").defaultRandom().unique().notNull(),
  itemId: uuid("item_id")
    .references(() => items.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Admin users table
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Series table
export const series = pgTable("series", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  seriesNumber: varchar("series_number", { length: 64 }).unique().notNull(),
  totalPieces: integer("total_pieces").notNull(),
  currentMintNumber: integer("current_mint_number").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SKU tracking table
export const skus = pgTable("skus", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).unique().notNull(),
  seriesId: integer("series_id")
    .notNull()
    .references(() => series.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Blockchain tables
export const blocks = pgTable("blocks", {
  id: serial("id").primaryKey(),
  blockNumber: bigint("block_number", { mode: "number" }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  previousHash: varchar("previous_hash", { length: 64 }).notNull(),
  merkleRoot: varchar("merkle_root", { length: 64 }).notNull(),
  blockNonce: bigint("block_nonce", { mode: "number" }).notNull(),
  hash: varchar("hash", { length: 64 }).unique().notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").references(() => blocks.id),
  transactionType: varchar("transaction_type", { length: 32 }).notNull(), // 'create', 'transfer', etc.
  itemId: uuid("item_id").notNull(), // Will be linked to items after items table is defined
  data: jsonb("data").notNull(), // Stores transaction-specific data
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  hash: varchar("hash", { length: 64 }).unique().notNull(),
  transactionNonce: varchar("transaction_nonce", { length: 64 })
    .unique()
    .notNull(),
});

export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  serialNumber: varchar("serial_number", { length: 64 }).unique().notNull(),
  sku: varchar("sku", { length: 64 })
    .notNull()
    .references(() => skus.code),
  mintNumber: varchar("mint_number", { length: 64 }).notNull(),
  weight: varchar("weight", { length: 32 }).notNull(),
  nfcSerialNumber: varchar("nfc_serial_number", { length: 64 })
    .unique()
    .notNull(),
  orderId: varchar("order_id", { length: 64 }).notNull(),
  originalOwnerName: varchar("original_owner_name", { length: 255 }).notNull(),
  originalOwnerEmail: varchar("original_owner_email", {
    length: 255,
  }).notNull(),
  // Original ownership info (immutable)
  originalPurchaseDate: timestamp("original_purchase_date").notNull(),
  purchasedFrom: varchar("purchased_from", { length: 255 }).notNull(),
  manufactureDate: timestamp("manufacture_date").notNull(),
  producedAt: varchar("produced_at", { length: 255 }).notNull(),

  // Chain linkage
  creationBlockId: integer("creation_block_id").references(() => blocks.id),
  latestTransactionId: integer("latest_transaction_id").references(
    () => transactions.id
  ),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  blockchainVersion: varchar("blockchain_version", { length: 32 })
    .default("v1")
    .notNull(),
  globalKeyVersion: varchar("global_key_version", { length: 64 }).notNull(),
  nfcLink: varchar("nfc_link", { length: 255 }).unique().notNull(),
});

export const ownershipTransfers = pgTable("ownership_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .references(() => items.id)
    .notNull(),
  currentOwnerEmail: varchar("current_owner_email", { length: 255 }).notNull(),
  newOwnerEmail: varchar("new_owner_email", { length: 255 }).notNull(),
  newOwnerName: varchar("new_owner_name", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isConfirmed: boolean("is_confirmed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userOwnershipVisibility = pgTable("user_ownership_visibility", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  visible: boolean("visible").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const globalEncryptionKeys = pgTable("global_encryption_keys", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 64 }).unique().notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  activeFrom: timestamp("active_from").notNull(),
  activeTo: timestamp("active_to").notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  itemId: uuid("item_id")
    .references(() => items.id)
    .notNull(),
  sessionToken: varchar("session_token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const authCodes = pgTable("auth_codes", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
});

// Relations
export const blockRelations = relations(blocks, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  block: one(blocks, {
    fields: [transactions.blockId],
    references: [blocks.id],
  }),
  item: one(items, {
    fields: [transactions.itemId],
    references: [items.id],
  }),
}));

export const itemRelations = relations(items, ({ many, one }) => ({
  transactions: many(transactions),
  ownershipHistory: many(ownershipTransfers, {
    relationName: "ownershipHistory",
  }),
  sessions: many(sessions),
  shortUrls: many(shortUrls),
  sku: one(skus, {
    fields: [items.sku],
    references: [skus.code],
  }),
  creationBlock: one(blocks, {
    fields: [items.creationBlockId],
    references: [blocks.id],
  }),
  latestTransaction: one(transactions, {
    fields: [items.latestTransactionId],
    references: [transactions.id],
  }),
}));

export const shortUrlRelations = relations(shortUrls, ({ one }) => ({
  item: one(items, {
    fields: [shortUrls.itemId],
    references: [items.id],
  }),
}));

export const ownershipTransfersRelations = relations(
  ownershipTransfers,
  ({ one }) => ({
    item: one(items, {
      fields: [ownershipTransfers.itemId],
      references: [items.id],
      relationName: "ownershipHistory",
    }),
  })
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  item: one(items, {
    fields: [sessions.itemId],
    references: [items.id],
  }),
}));

// Types
export type AdminUser = InferSelectModel<typeof adminUsers>;
export type Sku = InferSelectModel<typeof skus>;
export type Block = InferSelectModel<typeof blocks>;
export type Transaction = InferSelectModel<typeof transactions>;
export type Item = InferSelectModel<typeof items>;
export type ShortUrl = InferSelectModel<typeof shortUrls>;
export type OwnershipTransfer = InferSelectModel<typeof ownershipTransfers>;
export type UserOwnershipVisibility = InferSelectModel<
  typeof userOwnershipVisibility
>;
export type GlobalEncryptionKey = InferSelectModel<typeof globalEncryptionKeys>;
export type Session = InferSelectModel<typeof sessions>;
export type AuthCode = InferSelectModel<typeof authCodes>;
export type Series = InferSelectModel<typeof series>;

// Add series relation to SKU
export const skuRelations = relations(skus, ({ one }) => ({
  series: one(series, {
    fields: [skus.seriesId],
    references: [series.id],
  }),
}));

// Add SKU relation to series
export const seriesRelations = relations(series, ({ many }) => ({
  skus: many(skus),
}));
