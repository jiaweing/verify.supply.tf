import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env.mjs";
import * as schema from "./schema";

// Configuration for different environments
const isProd = env.NODE_ENV === "production";

// Create a PostgreSQL connection pool with optimized settings for production
const pool = new Pool({
  connectionString:
    env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/supply",
  // Maximum number of clients the pool should contain
  max: isProd ? 50 : 20,
  // Maximum time (ms) a client can sit idle in the pool
  idleTimeoutMillis: 30000,
  // Maximum time (ms) to wait for available connection
  connectionTimeoutMillis: isProd ? 5000 : 2000,
});

// Handle pool errors
pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle client:", err);
});

// Add pool connection monitoring in development
if (!isProd) {
  pool.on("connect", () => {
    console.log("New database connection established");
  });
  pool.on("acquire", () => {
    console.log("Client acquired from pool");
  });
  pool.on("remove", () => {
    console.log("Client removed from pool");
  });
}

// Validate pool connectivity immediately
pool
  .query("SELECT NOW()")
  .then(() => {
    if (!isProd)
      console.log("Database connection pool initialized successfully");
  })
  .catch((err: Error) => {
    console.error("Failed to initialize database connection pool:", err);
    process.exit(1); // Exit if we can't connect to the database
  });

// Initialize drizzle with the pool and schema
export const db = drizzle(pool, { schema });

// Export all tables and their types
export * from "./schema";

// Helper type for all tables
export type Schema = typeof schema;
