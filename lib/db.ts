if (typeof window !== 'undefined') {
  throw new Error('db.ts must only be used server-side')
}

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { calculatePortfolioSnapshot } from "@/lib/calculations";
import type { Asset, PortfolioSnapshot, PriceCache, Transaction, TransactionWithAsset, FxRate } from "@/types";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "portfolio.db");

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

declare global {
  var portfolioDb: ReturnType<typeof createClient> | undefined;
  var schemaInitialized: boolean;
}

// Lazy database client singleton
function getDb() {
  if (!global.portfolioDb) {
    global.portfolioDb = createClient({
      url: process.env.DATABASE_URL || "file:/app/data/portfolio.db",
    });
  }
  return global.portfolioDb;
}

// Initialize schema asynchronously (called on first use)
let schemaInitPromise: Promise<void> | null = null;

async function initializeSchema() {
  if (global.schemaInitialized) return;
  
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL CHECK(asset_class IN ('BIST', 'NASDAQ', 'FUND_TR', 'FUND_US', 'COMMODITY')),
      currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
      date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Update transactions table to include EUR in currency constraint
  try {
    const result = await db.execute("SELECT sql FROM sqlite_master WHERE name='transactions'");
    const tableSql = result.rows[0]?.sql as string;
    if (tableSql && !tableSql.includes("'EUR'")) {
      console.log("Running migration: Add EUR to transactions currency constraint");
      await db.execute("PRAGMA foreign_keys=off");
      await db.execute(`
        CREATE TABLE transactions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
          quantity REAL NOT NULL,
          price REAL NOT NULL,
          currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
          date DATE NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.execute(`
        INSERT INTO transactions_new (id, asset_id, type, quantity, price, currency, date, notes, created_at)
        SELECT id, asset_id, type, quantity, price, currency, date, notes, created_at FROM transactions
      `);
      await db.execute("DROP TABLE transactions");
      await db.execute("ALTER TABLE transactions_new RENAME TO transactions");
      await db.execute("PRAGMA foreign_keys=on");
      console.log("Migration completed successfully");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    await db.execute("PRAGMA foreign_keys=on");
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS price_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      price REAL NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS fx_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair TEXT NOT NULL UNIQUE,
      rate REAL NOT NULL,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  global.schemaInitialized = true;
}

async function ensureSchema() {
  if (!schemaInitPromise) {
    schemaInitPromise = initializeSchema();
  }
  await schemaInitPromise;
}

function mapAsset(row: Record<string, unknown>): Asset {
  return {
    id: Number(row.id),
    ticker: String(row.ticker),
    name: String(row.name),
    assetClass: row.asset_class as Asset["assetClass"],
    currency: row.currency as Asset["currency"],
    createdAt: String(row.created_at),
  };
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: Number(row.id),
    assetId: Number(row.asset_id),
    type: row.type as Transaction["type"],
    quantity: Number(row.quantity),
    price: Number(row.price),
    currency: row.currency as Transaction["currency"],
    date: String(row.date),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}

function mapPriceCache(row: Record<string, unknown>): PriceCache {
  return {
    id: Number(row.id),
    assetId: Number(row.asset_id),
    price: Number(row.price),
    currency: row.currency as PriceCache["currency"],
    fetchedAt: String(row.fetched_at),
  };
}

function mapFxRate(row: Record<string, unknown>): FxRate {
  return {
    id: Number(row.id),
    pair: String(row.pair),
    rate: Number(row.rate),
    fetchedAt: String(row.fetched_at),
  };
}

export async function getAssets(): Promise<Asset[]> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, ticker, name, asset_class, currency, created_at
          FROM assets
          ORDER BY ticker ASC`,
  });

  return result.rows.map(mapAsset);
}

export async function getTransactions(): Promise<TransactionWithAsset[]> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT
           t.id,
           t.asset_id,
           t.type,
           t.quantity,
           t.price,
           t.currency,
           t.date,
           t.notes,
           t.created_at,
           a.id AS joined_asset_id,
           a.ticker,
           a.name,
           a.asset_class,
           a.currency AS asset_currency,
           a.created_at AS asset_created_at
         FROM transactions t
         INNER JOIN assets a ON a.id = t.asset_id
         ORDER BY t.date DESC, t.id DESC`,
  });

  return result.rows.map((row) => ({
    ...mapTransaction(row),
    asset: {
      id: Number(row.joined_asset_id),
      ticker: String(row.ticker),
      name: String(row.name),
      assetClass: row.asset_class as Asset["assetClass"],
      currency: row.asset_currency as Asset["currency"],
      createdAt: String(row.asset_created_at),
    },
  }));
}

export async function insertAsset(asset: Omit<Asset, "id" | "createdAt">): Promise<Asset> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO assets (ticker, name, asset_class, currency)
          VALUES (?, ?, ?, ?)`,
    args: [asset.ticker, asset.name, asset.assetClass, asset.currency],
  });

  const insertId = result.lastInsertRowid ? Number(result.lastInsertRowid) : 0;
  
  const rowResult = await db.execute({
    sql: `SELECT id, ticker, name, asset_class, currency, created_at
          FROM assets
          WHERE id = ?`,
    args: [insertId],
  });

  return mapAsset(rowResult.rows[0]);
}

export async function insertTransaction(
  input: Omit<Transaction, "id" | "createdAt">,
): Promise<TransactionWithAsset> {
  await ensureSchema();
  
  const db = getDb();
  const assetResult = await db.execute({
    sql: `SELECT id, ticker, name, asset_class, currency, created_at
          FROM assets
          WHERE id = ?`,
    args: [input.assetId],
  });

  const asset = assetResult.rows[0];
  if (!asset) {
    throw new Error("Selected asset does not exist.");
  }

  const result = await db.execute({
    sql: `INSERT INTO transactions (asset_id, type, quantity, price, currency, date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [input.assetId, input.type, input.quantity, input.price, input.currency, input.date, input.notes],
  });

  const insertId = result.lastInsertRowid ? Number(result.lastInsertRowid) : 0;
  
  const rowResult = await db.execute({
    sql: `SELECT
           t.id,
           t.asset_id,
           t.type,
           t.quantity,
           t.price,
           t.currency,
           t.date,
           t.notes,
           t.created_at,
           a.id AS joined_asset_id,
           a.ticker,
           a.name,
           a.asset_class,
           a.currency AS asset_currency,
           a.created_at AS asset_created_at
         FROM transactions t
         INNER JOIN assets a ON a.id = t.asset_id
         WHERE t.id = ?`,
    args: [insertId],
  });

  const row = rowResult.rows[0];
  return {
    ...mapTransaction(row),
    asset: {
      id: Number(row.joined_asset_id),
      ticker: String(row.ticker),
      name: String(row.name),
      assetClass: row.asset_class as Asset["assetClass"],
      currency: row.asset_currency as Asset["currency"],
      createdAt: String(row.asset_created_at),
    },
  };
}

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const transactions = await getTransactions();
  const prices = await getLatestPrices();
  return await calculatePortfolioSnapshot(transactions, prices);
}

export async function getLatestPrices(): Promise<Map<number, PriceCache>> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT pc.id, pc.asset_id, pc.price, pc.currency, pc.fetched_at
          FROM price_cache pc
          INNER JOIN (
            SELECT asset_id, MAX(fetched_at) AS max_fetched_at
            FROM price_cache
            GROUP BY asset_id
          ) latest
            ON latest.asset_id = pc.asset_id
           AND latest.max_fetched_at = pc.fetched_at`,
  });

  return new Map(result.rows.map((row) => {
    const price = mapPriceCache(row);
    return [price.assetId, price] as const;
  }));
}

export async function getLastCachedPrice(assetId: number): Promise<PriceCache | null> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, asset_id, price, currency, fetched_at
          FROM price_cache
          WHERE asset_id = ?
          ORDER BY fetched_at DESC, id DESC
          LIMIT 1`,
    args: [assetId],
  });

  if (result.rows.length === 0) return null;
  return mapPriceCache(result.rows[0]);
}

export async function insertPriceCacheEntry(
  assetId: number,
  price: number,
  currency: PriceCache["currency"],
): Promise<PriceCache> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO price_cache (asset_id, price, currency)
          VALUES (?, ?, ?)`,
    args: [assetId, price, currency],
  });

  const insertId = result.lastInsertRowid ? Number(result.lastInsertRowid) : 0;
  
  const rowResult = await db.execute({
    sql: `SELECT id, asset_id, price, currency, fetched_at
          FROM price_cache
          WHERE id = ?`,
    args: [insertId],
  });

  return mapPriceCache(rowResult.rows[0]);
}

export async function getFxRates(): Promise<FxRate[]> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, pair, rate, fetched_at
          FROM fx_rates
          ORDER BY pair ASC`,
  });

  return result.rows.map(mapFxRate);
}

export async function getFxRate(pair: string): Promise<FxRate | null> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, pair, rate, fetched_at
          FROM fx_rates
          WHERE pair = ?
          ORDER BY fetched_at DESC, id DESC
          LIMIT 1`,
    args: [pair],
  });

  if (result.rows.length === 0) return null;
  return mapFxRate(result.rows[0]);
}

export async function insertFxRate(pair: string, rate: number): Promise<FxRate> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO fx_rates (pair, rate)
          VALUES (?, ?)`,
    args: [pair, rate],
  });

  const insertId = result.lastInsertRowid ? Number(result.lastInsertRowid) : 0;
  
  const rowResult = await db.execute({
    sql: `SELECT id, pair, rate, fetched_at
          FROM fx_rates
          WHERE id = ?`,
    args: [insertId],
  });

  return mapFxRate(rowResult.rows[0]);
}

export async function updateAsset(
  id: number,
  updates: Partial<Omit<Asset, "id" | "createdAt">>,
): Promise<Asset> {
  await ensureSchema();
  
  const db = getDb();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.assetClass !== undefined) {
    fields.push("asset_class = ?");
    values.push(updates.assetClass);
  }
  if (updates.currency !== undefined) {
    fields.push("currency = ?");
    values.push(updates.currency);
  }

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(id);

  await db.execute({
    sql: `UPDATE assets SET ${fields.join(", ")} WHERE id = ?`,
    args: values,
  });

  const result = await db.execute({
    sql: `SELECT id, ticker, name, asset_class, currency, created_at
          FROM assets
          WHERE id = ?`,
    args: [id],
  });

  return mapAsset(result.rows[0]);
}

export async function deleteAsset(id: number): Promise<void> {
  await ensureSchema();
  
  const db = getDb();
  
  // Delete associated transactions first (cascading)
  await db.execute({
    sql: `DELETE FROM transactions WHERE asset_id = ?`,
    args: [id],
  });
  
  // Delete the asset
  await db.execute({
    sql: `DELETE FROM assets WHERE id = ?`,
    args: [id],
  });
}

export async function getTransactionCountByAsset(assetId: number): Promise<number> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM transactions WHERE asset_id = ?`,
    args: [assetId],
  });

  return Number(result.rows[0].count);
}

export async function updateTransaction(
  id: number,
  updates: Partial<Omit<Transaction, "id" | "createdAt">>,
): Promise<TransactionWithAsset> {
  await ensureSchema();
  
  const db = getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.type !== undefined) {
    fields.push("type = ?");
    values.push(updates.type);
  }
  if (updates.quantity !== undefined) {
    fields.push("quantity = ?");
    values.push(updates.quantity);
  }
  if (updates.price !== undefined) {
    fields.push("price = ?");
    values.push(updates.price);
  }
  if (updates.currency !== undefined) {
    fields.push("currency = ?");
    values.push(updates.currency);
  }
  if (updates.date !== undefined) {
    fields.push("date = ?");
    values.push(updates.date);
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?");
    values.push(updates.notes);
  }

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(id);

  await db.execute({
    sql: `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`,
    args: values,
  });

  const result = await db.execute({
    sql: `SELECT
           t.id,
           t.asset_id,
           t.type,
           t.quantity,
           t.price,
           t.currency,
           t.date,
           t.notes,
           t.created_at,
           a.id AS joined_asset_id,
           a.ticker,
           a.name,
           a.asset_class,
           a.currency AS asset_currency,
           a.created_at AS asset_created_at
         FROM transactions t
         INNER JOIN assets a ON a.id = t.asset_id
         WHERE t.id = ?`,
    args: [id],
  });

  const row = result.rows[0];
  return {
    ...mapTransaction(row),
    asset: {
      id: Number(row.joined_asset_id),
      ticker: String(row.ticker),
      name: String(row.name),
      assetClass: row.asset_class as Asset["assetClass"],
      currency: row.asset_currency as Asset["currency"],
      createdAt: String(row.asset_created_at),
    },
  };
}

export async function deleteTransaction(id: number): Promise<void> {
  await ensureSchema();
  
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM transactions WHERE id = ?`,
    args: [id],
  });
}

export async function getPositionQuantity(assetId: number): Promise<number> {
  await ensureSchema();
  
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT COALESCE(SUM(CASE WHEN type = 'BUY' THEN quantity ELSE -quantity END), 0) as quantity
          FROM transactions
          WHERE asset_id = ?`,
    args: [assetId],
  });

  return Number(result.rows[0].quantity);
}
