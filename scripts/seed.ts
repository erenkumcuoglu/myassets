import { insertAsset, insertTransaction, insertPriceCacheEntry } from "@/lib/db";
import type { AssetClass, Currency, TransactionType } from "@/types";

// Insert sample assets
const assets = [
  { ticker: "GARAN", name: "Garanti BBVA", assetClass: "BIST" as AssetClass, currency: "TRY" as Currency },
  { ticker: "ISCTR", name: "İş Bankası", assetClass: "BIST" as AssetClass, currency: "TRY" as Currency },
  { ticker: "MSFT", name: "Microsoft Corporation", assetClass: "NASDAQ" as AssetClass, currency: "USD" as Currency },
  { ticker: "NVDA", name: "NVIDIA Corporation", assetClass: "NASDAQ" as AssetClass, currency: "USD" as Currency },
  { ticker: "TI2", name: "Tera Portföy Hisse Senedi Yoğun Fon", assetClass: "FUND_TR" as AssetClass, currency: "TRY" as Currency },
  { ticker: "MAC", name: "Ak Portföy Büyüme Amaçlı Hisse Senedi Fonu", assetClass: "FUND_TR" as AssetClass, currency: "TRY" as Currency },
];

async function seed() {
  const insertedAssets: Array<{ id: number; ticker: string }> = [];

  for (const asset of assets) {
    try {
      const inserted = await insertAsset(asset);
      insertedAssets.push({ id: inserted.id, ticker: inserted.ticker });
      console.log(`✅ Inserted asset: ${inserted.ticker}`);
    } catch (error) {
      console.log(`⚠️  Asset already exists or error: ${asset.ticker}`);
    }
  }

  // Get asset IDs for transactions
  const getAssetId = (ticker: string) => {
    const asset = insertedAssets.find((a) => a.ticker === ticker);
    return asset?.id || 0;
  };

  // Insert sample transactions
  const transactions = [
    // GARAN transactions
    { assetId: getAssetId("GARAN"), type: "BUY" as TransactionType, quantity: 100, price: 8.50, currency: "TRY" as Currency, date: "2024-01-15", notes: "Initial purchase" },
    { assetId: getAssetId("GARAN"), type: "BUY" as TransactionType, quantity: 50, price: 8.20, currency: "TRY" as Currency, date: "2024-03-10", notes: null },
    { assetId: getAssetId("GARAN"), type: "SELL" as TransactionType, quantity: 30, price: 9.50, currency: "TRY" as Currency, date: "2024-06-20", notes: "Partial profit taking" },
    
    // ISCTR transactions
    { assetId: getAssetId("ISCTR"), type: "BUY" as TransactionType, quantity: 200, price: 15.00, currency: "TRY" as Currency, date: "2024-02-01", notes: null },
    { assetId: getAssetId("ISCTR"), type: "BUY" as TransactionType, quantity: 100, price: 14.50, currency: "TRY" as Currency, date: "2024-04-15", notes: "Dip alım" },
    
    // MSFT transactions
    { assetId: getAssetId("MSFT"), type: "BUY" as TransactionType, quantity: 10, price: 380.00, currency: "USD" as Currency, date: "2024-01-20", notes: null },
    { assetId: getAssetId("MSFT"), type: "BUY" as TransactionType, quantity: 5, price: 420.00, currency: "USD" as Currency, date: "2024-05-10", notes: "Average up" },
    
    // NVDA transactions
    { assetId: getAssetId("NVDA"), type: "BUY" as TransactionType, quantity: 5, price: 450.00, currency: "USD" as Currency, date: "2024-02-15", notes: "AI growth bet" },
    { assetId: getAssetId("NVDA"), type: "SELL" as TransactionType, quantity: 2, price: 880.00, currency: "USD" as Currency, date: "2024-06-01", notes: "Take some profits" },
    
    // TI2 transactions
    { assetId: getAssetId("TI2"), type: "BUY" as TransactionType, quantity: 1000, price: 5.50, currency: "TRY" as Currency, date: "2024-01-10", notes: null },
    
    // MAC transactions
    { assetId: getAssetId("MAC"), type: "BUY" as TransactionType, quantity: 500, price: 12.00, currency: "TRY" as Currency, date: "2024-03-01", notes: null },
  ];

  for (const tx of transactions) {
    if (tx.assetId > 0) {
      try {
        await insertTransaction(tx);
        console.log(`✅ Inserted transaction for asset_id: ${tx.assetId}`);
      } catch (error) {
        console.log(`⚠️  Transaction error for asset_id: ${tx.assetId}`);
      }
    }
  }

  // Insert sample price cache entries
  const priceCache = [
    { asset_id: getAssetId("GARAN"), price: 9.80, currency: "TRY" as Currency },
    { asset_id: getAssetId("ISCTR"), price: 16.50, currency: "TRY" as Currency },
    { asset_id: getAssetId("MSFT"), price: 415.00, currency: "USD" as Currency },
    { asset_id: getAssetId("NVDA"), price: 920.00, currency: "USD" as Currency },
    { asset_id: getAssetId("TI2"), price: 6.20, currency: "TRY" as Currency },
    { asset_id: getAssetId("MAC"), price: 13.50, currency: "TRY" as Currency },
  ];

  for (const pc of priceCache) {
    if (pc.asset_id > 0) {
      try {
        await insertPriceCacheEntry(pc.asset_id, pc.price, pc.currency);
        console.log(`✅ Inserted price cache for asset_id: ${pc.asset_id}`);
      } catch (error) {
        console.log(`⚠️  Price cache error for asset_id: ${pc.asset_id}`);
      }
    }
  }

  console.log("✅ Database seeded successfully!");
  console.log(`📊 Assets added: ${insertedAssets.length}`);
  console.log(`📝 Transactions added: ${transactions.length}`);
  console.log(`💰 Price cache entries added: ${priceCache.length}`);
}

seed().catch(console.error);
