import { supabase } from "./supabase";
import { calculatePortfolioSnapshot } from "@/lib/calculations";
import type { Asset, PortfolioSnapshot, PriceCache, Transaction, TransactionWithAsset, FxRate } from "@/types";

// Initialize Supabase tables on first use
let schemaInitialized = false;

async function initializeSchema() {
  if (schemaInitialized) return;

  // Create tables using Supabase SQL (run via SQL editor in Supabase dashboard)
  console.log('Please ensure tables exist in Supabase: assets, transactions, price_cache, fx_rates');
  
  schemaInitialized = true;
}

async function ensureSchema() {
  if (!supabase) {
    throw new Error('Supabase client not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  }
  if (!schemaInitialized) {
    await initializeSchema();
  }
}

export async function initDb() {
  await ensureSchema();
}

function mapAsset(row: any): Asset {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    assetClass: row.asset_class,
    currency: row.currency,
    createdAt: row.created_at,
  };
}

function mapTransaction(row: any): Transaction {
  return {
    id: row.id,
    assetId: row.asset_id,
    type: row.type,
    quantity: row.quantity,
    price: row.price,
    currency: row.currency,
    date: row.date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapPriceCache(row: any): PriceCache {
  return {
    id: row.id,
    assetId: row.asset_id,
    price: row.price,
    currency: row.currency,
    fetchedAt: row.fetched_at,
  };
}

function mapFxRate(row: any): FxRate {
  return {
    id: row.id,
    pair: row.pair,
    rate: row.rate,
    fetchedAt: row.fetched_at,
  };
}

export async function getAssets(): Promise<Asset[]> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('ticker', { ascending: true });

  if (error) throw error;
  return data?.map(mapAsset) || [];
}

export async function getTransactions(): Promise<TransactionWithAsset[]> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      assets (
        id,
        ticker,
        name,
        asset_class,
        currency,
        created_at
      )
    `)
    .order('date', { ascending: false })
    .order('id', { ascending: false });

  if (error) throw error;

  return data?.map((row: any) => ({
    ...mapTransaction(row),
    asset: mapAsset(row.assets),
  })) || [];
}

export async function insertAsset(asset: Omit<Asset, "id" | "createdAt">): Promise<Asset> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('assets')
    .insert({
      ticker: asset.ticker,
      name: asset.name,
      asset_class: asset.assetClass,
      currency: asset.currency,
    })
    .select()
    .single();

  if (error) throw error;
  return mapAsset(data);
}

export async function insertTransaction(
  input: Omit<Transaction, "id" | "createdAt">,
): Promise<TransactionWithAsset> {
  await ensureSchema();

  const { data: assetData, error: assetError } = await supabase
    .from('assets')
    .select('*')
    .eq('id', input.assetId)
    .single();

  if (assetError || !assetData) {
    throw new Error("Selected asset does not exist.");
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      asset_id: input.assetId,
      type: input.type,
      quantity: input.quantity,
      price: input.price,
      currency: input.currency,
      date: input.date,
      notes: input.notes,
    })
    .select(`
      *,
      assets (
        id,
        ticker,
        name,
        asset_class,
        currency,
        created_at
      )
    `)
    .single();

  if (error) throw error;

  return {
    ...mapTransaction(data),
    asset: mapAsset(data.assets),
  };
}

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const transactions = await getTransactions();
  const prices = await getLatestPrices();
  return await calculatePortfolioSnapshot(transactions, prices);
}

export async function getLatestPrices(): Promise<Map<number, PriceCache>> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('price_cache')
    .select('*')
    .order('fetched_at', { ascending: false });

  if (error) {
    console.error('[getLatestPrices] Supabase error:', error);
    throw error;
  }

  // Get latest price per asset
  const latestPrices = new Map<number, PriceCache>();
  const seen = new Set<number>();

  for (const row of data || []) {
    if (!seen.has(row.asset_id)) {
      latestPrices.set(row.asset_id, mapPriceCache(row));
      seen.add(row.asset_id);
    }
  }

  return latestPrices;
}

export async function getLastCachedPrice(assetId: number): Promise<PriceCache | null> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('price_cache')
    .select('*')
    .eq('asset_id', assetId)
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return mapPriceCache(data);
}

export async function insertPriceCacheEntry(assetId: number, price: number, currency: "TRY" | "USD" | "EUR") {
  await ensureSchema();

  const { error } = await supabase
    .from('price_cache')
    .insert({
      asset_id: assetId,
      price: price,
      currency: currency,
    });

  if (error) throw error;
}

export async function clearPriceCache() {
  await ensureSchema();

  const { error } = await supabase
    .from('price_cache')
    .delete()
    .neq('id', 0); // Delete all

  if (error) throw error;
}

export async function updateCommodityAssetCurrencies() {
  await ensureSchema();

  const { error } = await supabase
    .from('assets')
    .update({ currency: 'TRY' })
    .eq('asset_class', 'COMMODITY');

  if (error) throw error;
}

export async function getFxRates(): Promise<FxRate[]> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('fx_rates')
    .select('*')
    .order('pair', { ascending: true });

  if (error) throw error;
  return data?.map(mapFxRate) || [];
}

export async function getFxRate(pair: string): Promise<FxRate | null> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('fx_rates')
    .select('*')
    .eq('pair', pair)
    .order('fetched_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return mapFxRate(data);
}

export async function insertFxRate(pair: string, rate: number): Promise<FxRate> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('fx_rates')
    .insert({ pair, rate })
    .select()
    .single();

  if (error) throw error;
  return mapFxRate(data);
}

export async function updateAsset(
  id: number,
  updates: Partial<Omit<Asset, "id" | "createdAt">>,
): Promise<Asset> {
  await ensureSchema();

  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.assetClass !== undefined) updateData.asset_class = updates.assetClass;
  if (updates.currency !== undefined) updateData.currency = updates.currency;

  if (Object.keys(updateData).length === 0) {
    throw new Error("No fields to update");
  }

  const { data, error } = await supabase
    .from('assets')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapAsset(data);
}

export async function deleteAsset(id: number): Promise<void> {
  await ensureSchema();

  // Transactions will cascade delete due to FK constraint
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getTransactionCountByAsset(assetId: number): Promise<number> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('asset_id', assetId);

  if (error) throw error;
  return data ? data.length : 0;
}

export async function updateTransaction(
  id: number,
  updates: Partial<Omit<Transaction, "id" | "createdAt">>,
): Promise<TransactionWithAsset> {
  await ensureSchema();

  const updateData: any = {};
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.currency !== undefined) updateData.currency = updates.currency;
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  if (Object.keys(updateData).length === 0) {
    throw new Error("No fields to update");
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      assets (
        id,
        ticker,
        name,
        asset_class,
        currency,
        created_at
      )
    `)
    .single();

  if (error) throw error;

  return {
    ...mapTransaction(data),
    asset: mapAsset(data.assets),
  };
}

export async function deleteTransaction(id: number): Promise<void> {
  await ensureSchema();

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getPositionQuantity(assetId: number): Promise<number> {
  await ensureSchema();

  const { data, error } = await supabase
    .from('transactions')
    .select('quantity, type')
    .eq('asset_id', assetId);

  if (error) throw error;

  let quantity = 0;
  for (const row of data || []) {
    if (row.type === 'BUY') {
      quantity += row.quantity;
    } else {
      quantity -= row.quantity;
    }
  }

  return quantity;
}
