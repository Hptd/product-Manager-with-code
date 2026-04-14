// Prisma Client 单例
import { PrismaClient } from '../../generated/prisma/index.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';

// tsx 运行时支持 import.meta，但需要运行时获取路径
const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace('file:', '')
  : path.join(process.cwd(), 'data.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
