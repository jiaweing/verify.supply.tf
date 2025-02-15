import { InferSelectModel, relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Admin users table
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SKU tracking table
export const skus = pgTable("skus", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).unique().notNull(),
  currentMintNumber: integer("current_mint_number").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Items table (renamed from items)
export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  blockId: varchar("block_id", { length: 64 }).unique().notNull(),
  serialNumber: varchar("serial_number", { length: 64 }).unique().notNull(),
  sku: varchar("sku", { length: 64 })
    .notNull()
    .references(() => skus.code),
  mintNumber: varchar("mint_number", { length: 64 }).unique().notNull(),
  weight: varchar("weight", { length: 32 }).notNull(),
  nfcSerialNumber: varchar("nfc_serial_number", { length: 64 })
    .unique()
    .notNull(),
  orderId: varchar("order_id", { length: 64 }).notNull(),
  originalOwnerName: varchar("original_owner_name", { length: 255 }).notNull(),
  originalOwnerEmail: varchar("original_owner_email", {
    length: 255,
  }).notNull(),
  currentOwnerName: varchar("current_owner_name", { length: 255 }).notNull(),
  currentOwnerEmail: varchar("current_owner_email", { length: 255 }).notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  purchasedFrom: varchar("purchased_from", { length: 255 }).notNull(),
  manufactureDate: timestamp("manufacture_date").notNull(),
  producedAt: varchar("produced_at", { length: 255 }).notNull(),
  currentBlockHash: varchar("current_block_hash", { length: 64 }).notNull(),
  previousBlockHash: varchar("previous_block_hash", { length: 64 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
  itemEncryptionKeyHash: varchar("item_encryption_key_hash", {
    length: 64,
  }).notNull(),
  globalKeyVersion: varchar("global_key_version", { length: 64 }).notNull(),
  nfcLink: varchar("nfc_link", { length: 255 }).unique().notNull(),
});

export const ownershipHistory = pgTable("ownership_history", {
  id: serial("id").primaryKey(),
  itemId: uuid("item_id")
    .references(() => items.id)
    .notNull(),
  ownerName: varchar("owner_name", { length: 255 }).notNull(),
  ownerEmail: varchar("owner_email", { length: 255 }).notNull(),
  transferDate: timestamp("transfer_date").defaultNow().notNull(),
});

export const ownershipTransfers = pgTable("ownership_transfers", {
  id: serial("id").primaryKey(),
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

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  itemId: uuid("item_id")
    .references(() => items.id)
    .notNull(),
  showOwnershipHistory: boolean("show_ownership_history")
    .default(true)
    .notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const authCodes = pgTable("auth_codes", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const itemRelations = relations(items, ({ many, one }) => ({
  ownershipHistory: many(ownershipHistory),
  ownershipTransfers: many(ownershipTransfers),
  userPreferences: many(userPreferences),
  sessions: many(sessions),
  sku: one(skus, {
    fields: [items.sku],
    references: [skus.code],
  }),
}));

export const ownershipHistoryRelations = relations(
  ownershipHistory,
  ({ one }) => ({
    item: one(items, {
      fields: [ownershipHistory.itemId],
      references: [items.id],
    }),
  })
);

export const ownershipTransfersRelations = relations(
  ownershipTransfers,
  ({ one }) => ({
    item: one(items, {
      fields: [ownershipTransfers.itemId],
      references: [items.id],
    }),
  })
);

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    item: one(items, {
      fields: [userPreferences.itemId],
      references: [items.id],
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
export type Item = InferSelectModel<typeof items>;
export type OwnershipHistory = InferSelectModel<typeof ownershipHistory>;
export type OwnershipTransfer = InferSelectModel<typeof ownershipTransfers>;
export type UserPreference = InferSelectModel<typeof userPreferences>;
export type GlobalEncryptionKey = InferSelectModel<typeof globalEncryptionKeys>;
export type Session = InferSelectModel<typeof sessions>;
export type AuthCode = InferSelectModel<typeof authCodes>;
