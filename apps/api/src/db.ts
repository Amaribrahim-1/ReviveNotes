import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client.js";
import dotenv from "dotenv";

const directory = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(directory, "../.env"), override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Add it to apps/api/.env.");
}

// The local database closes idle sockets. A short idle timeout drops our side
// first, so the next query opens a new socket instead of reusing a dead one.
const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  keepAlive: true,
});

const adapter = new PrismaPg(pool, {
  onPoolError(error) {
    console.error(error);
  },
});

const client = new PrismaClient({ adapter });

function closedConnection(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P1017";
}

// One retry. The first try can hit a socket the database already closed.
export const prisma = client.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!closedConnection(error)) {
            throw error;
          }
          return query(args);
        }
      },
    },
  },
});
