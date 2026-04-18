import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { calculatePortfolioSnapshot } from "@/lib/calculations";
import type {
  Asset,
  PortfolioSnapshot,
  PriceCache,
  Transaction,
  TransactionInput,
  TransactionWithAsset,
} from "@/types";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "portfolio.db");

declare global {
  var portfolioDb: Database.Database | undefined;
}

function hasRequiredColumns(database: Database.Database, tableName: string, columns: string[]) {
  const table = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(tableName) as { name?: string } | undefined;

  if (!table?.name) {
    return false;
  }

  const rows = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  const existingColumns = new Set(rows.map((row) => row.name));
  return columns.every((column) => existingColumns.has(column));
}

function archiveLegacyTable(database: Database.Database, tableName: string) {
  const legacyName = `${tableName}_legacy`;
  const existingLegacy = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(legacyName) as { name?: string } | undefined;

  if (!existingLegacy?.name) {
    database.exec(`ALTER TABLE ${tableName} RENAME TO ${legacyName}`);
  }
}

function ensureDatabase() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  const database =
    global.portfolioDb ??
    new Database(databasePath, {
      fileMustExist: false,
    });

  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  if (
    !hasRequiredColumns(database, "assets", [
      "id",
      "ticker",
      "name",
      "asset_class",
      "currency",
      "created_at",
    ])
  ) {
    if (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'assets'",
        )
        .get()
    ) {
      archiveLegacyTable(database, "assets");
    }
  }

  if (
    !hasRequiredColumns(database, "transactions", [
      "id",
      "asset_id",
      "type",
      "quantity",
      "price",
      "currency",
      "date",
      "notes",
      "created_at",
    ])
  ) {
    if (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transactions'",
        )
        .get()
    ) {
      archiveLegacyTable(database, "transactions");
    }
  }

  if (
    !hasRequiredColumns(database, "price_cache", [
      "id",
      "asset_id",
      "price",
      "currency",
      "fetched_at",
    ])
  ) {
    if (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'price_cache'",
        )
        .get()
    ) {
      archiveLegacyTable(database, "price_cache");
    }
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL CHECK(asset_class IN ('BIST', 'NASDAQ', 'FUND_TR', 'FUND_US', 'COMMODITY')),
      currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER REFERENCES assets(id),
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD')),
      date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS price_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER REFERENCES assets(id),
      price REAL NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD')),
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!global.portfolioDb) {
    global.portfolioDb = database;
  }

  seedDatabase(database);

  return database;
}

function seedDatabase(database: Database.Database) {
  const assetCount = database
    .prepare("SELECT COUNT(*) AS count FROM assets")
    .get() as { count: number };

  if (assetCount.count > 0) {
    return;
  }

  const insertAsset = database.prepare(`
    INSERT INTO assets (ticker, name, asset_class, currency)
    VALUES (@ticker, @name, @assetClass, @currency)
  `);

  const insertTransaction = database.prepare(`
    INSERT INTO transactions (asset_id, type, quantity, price, currency, date, notes)
    VALUES (@assetId, @type, @quantity, @price, @currency, @date, @notes)
  `);

  const insertPrice = database.prepare(`
    INSERT INTO price_cache (asset_id, price, currency)
    VALUES (@assetId, @price, @currency)
  `);

  database.transaction(() => {
    const assets = [
      {
        ticker: "AAPL",
        name: "Apple Inc.",
        assetClass: "NASDAQ",
        currency: "USD",
      },
      {
        ticker: "NVDA",
        name: "NVIDIA Corporation",
        assetClass: "NASDAQ",
        currency: "USD",
      },
      {
        ticker: "VOO",
        name: "Vanguard S&P 500 ETF",
        assetClass: "FUND_US",
        currency: "USD",
      },
      {
        ticker: "XAU",
        name: "Gold Ounce",
        assetClass: "COMMODITY",
        currency: "USD",
      },
    ] as const;

    const assetIds = new Map<string, number>();

    for (const asset of assets) {
      const result = insertAsset.run(asset);
      assetIds.set(asset.ticker, Number(result.lastInsertRowid));
    }

    const seededTransactions: TransactionInput[] = [
      {
        assetId: assetIds.get("AAPL")!,
        type: "BUY",
        quantity: 12,
        price: 176.25,
        currency: "USD",
        date: "2026-02-10",
        notes: "Core tech position",
      },
      {
        assetId: assetIds.get("NVDA")!,
        type: "BUY",
        quantity: 8,
        price: 121.4,
        currency: "USD",
        date: "2026-02-18",
        notes: "AI allocation",
      },
      {
        assetId: assetIds.get("AAPL")!,
        type: "BUY",
        quantity: 4,
        price: 183.1,
        currency: "USD",
        date: "2026-03-06",
        notes: "Added on weakness",
      },
      {
        assetId: assetIds.get("VOO")!,
        type: "BUY",
        quantity: 5,
        price: 498.65,
        currency: "USD",
        date: "2026-03-12",
        notes: "Broad market exposure",
      },
      {
        assetId: assetIds.get("NVDA")!,
        type: "SELL",
        quantity: 2,
        price: 134.9,
        currency: "USD",
        date: "2026-04-01",
        notes: "Trimmed after a run-up",
      },
    ];

    for (const transaction of seededTransactions) {
      insertTransaction.run(transaction);
    }

    insertPrice.run({
      assetId: assetIds.get("AAPL")!,
      price: 191.85,
      currency: "USD",
    });
    insertPrice.run({
      assetId: assetIds.get("NVDA")!,
      price: 141.5,
      currency: "USD",
    });
    insertPrice.run({
      assetId: assetIds.get("VOO")!,
      price: 512.4,
      currency: "USD",
    });
    insertPrice.run({
      assetId: assetIds.get("XAU")!,
      price: 2388.2,
      currency: "USD",
    });
  })();
}

const db = ensureDatabase();

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

export function getAssets(): Asset[] {
  const rows = db
    .prepare(
      `SELECT id, ticker, name, asset_class, currency, created_at
       FROM assets
       ORDER BY ticker ASC`,
    )
    .all() as Record<string, unknown>[];

  return rows.map(mapAsset);
}

export function getTransactions(): TransactionWithAsset[] {
  const rows = db
    .prepare(
      `SELECT
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
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
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

export function getLatestPrices(): Map<number, PriceCache> {
  const rows = db
    .prepare(
      `SELECT pc.id, pc.asset_id, pc.price, pc.currency, pc.fetched_at
       FROM price_cache pc
       INNER JOIN (
         SELECT asset_id, MAX(fetched_at) AS max_fetched_at
         FROM price_cache
         GROUP BY asset_id
       ) latest
         ON latest.asset_id = pc.asset_id
        AND latest.max_fetched_at = pc.fetched_at`,
    )
    .all() as Record<string, unknown>[];

  return new Map(rows.map((row) => {
    const price = mapPriceCache(row);
    return [price.assetId, price] as const;
  }));
}

export function getRecentPriceCacheEntries(limit = 2): Map<number, PriceCache[]> {
  const rows = db
    .prepare(
      `SELECT id, asset_id, price, currency, fetched_at
       FROM price_cache
       ORDER BY asset_id ASC, fetched_at DESC, id DESC`,
    )
    .all() as Record<string, unknown>[];

  const grouped = new Map<number, PriceCache[]>();

  for (const row of rows) {
    const entry = mapPriceCache(row);
    const existing = grouped.get(entry.assetId) ?? [];

    if (existing.length < limit) {
      existing.push(entry);
      grouped.set(entry.assetId, existing);
    }
  }

  return grouped;
}

export function getLastCachedPrice(assetId: number): PriceCache | null {
  const row = db
    .prepare(
      `SELECT id, asset_id, price, currency, fetched_at
       FROM price_cache
       WHERE asset_id = ?
       ORDER BY fetched_at DESC, id DESC
       LIMIT 1`,
    )
    .get(assetId) as Record<string, unknown> | undefined;

  return row ? mapPriceCache(row) : null;
}

export function insertPriceCacheEntry(
  assetId: number,
  price: number,
  currency: PriceCache["currency"],
): PriceCache {
  const result = db
    .prepare(
      `INSERT INTO price_cache (asset_id, price, currency)
       VALUES (?, ?, ?)`,
    )
    .run(assetId, price, currency);

  const row = db
    .prepare(
      `SELECT id, asset_id, price, currency, fetched_at
       FROM price_cache
       WHERE id = ?`,
    )
    .get(result.lastInsertRowid) as Record<string, unknown>;

  return mapPriceCache(row);
}

export function insertTransaction(input: TransactionInput): TransactionWithAsset {
  const asset = db
    .prepare(
      `SELECT id, ticker, name, asset_class, currency, created_at
       FROM assets
       WHERE id = ?`,
    )
    .get(input.assetId) as Record<string, unknown> | undefined;

  if (!asset) {
    throw new Error("Selected asset does not exist.");
  }

  const currentSnapshot = calculatePortfolioSnapshot(
    getTransactions(),
    getLatestPrices(),
  );
  const existingPosition = currentSnapshot.positions.find(
    (position) => position.asset.id === input.assetId,
  );

  if (
    input.type === "SELL" &&
    (!existingPosition || input.quantity > existingPosition.totalQuantity)
  ) {
    throw new Error("Sell quantity exceeds the currently tracked position.");
  }

  const result = db
    .prepare(
      `INSERT INTO transactions (
        asset_id,
        type,
        quantity,
        price,
        currency,
        date,
        notes
      ) VALUES (
        @assetId,
        @type,
        @quantity,
        @price,
        @currency,
        @date,
        @notes
      )`,
    )
    .run({
      ...input,
      notes: input.notes ?? "",
    });

  const row = db
    .prepare(
      `SELECT
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
    )
    .get(result.lastInsertRowid) as Record<string, unknown>;

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

export function getPortfolioSnapshot(): PortfolioSnapshot {
  return calculatePortfolioSnapshot(getTransactions(), getLatestPrices());
}
