-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS price_cache CASCADE;
DROP TABLE IF EXISTS fx_rates CASCADE;
DROP TABLE IF EXISTS assets CASCADE;

-- Create assets table
CREATE TABLE assets (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK(asset_class IN ('BIST', 'NASDAQ', 'FUND_TR', 'FUND_US', 'COMMODITY')),
  currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create price_cache table
CREATE TABLE price_cache (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create fx_rates table
CREATE TABLE fx_rates (
  id BIGSERIAL PRIMARY KEY,
  pair TEXT NOT NULL UNIQUE,
  rate NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional, can be disabled for simplicity)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (for development)
CREATE POLICY "Enable all access for assets" ON assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for price_cache" ON price_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for fx_rates" ON fx_rates FOR ALL USING (true) WITH CHECK (true);
