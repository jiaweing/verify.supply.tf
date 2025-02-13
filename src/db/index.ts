import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env.mjs";
import * as schema from "./schema";

// Create a PostgreSQL connection pool using the connection string
const pool = new Pool({
  connectionString:
    env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/verify_supply_tf",
});

// Initialize drizzle with the pool and schema
export const db = drizzle(pool, { schema });

// Export all tables and their types
export * from "./schema";

// Helper type for all tables
export type Schema = typeof schema;
