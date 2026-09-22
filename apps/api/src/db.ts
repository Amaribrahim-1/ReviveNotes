import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import dotenv from "dotenv";

const directory = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(directory, "../.env"), override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Add it to apps/api/.env.");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
