"use strict";exports.id=850,exports.ids=[850],exports.modules={7880:(t,e,a)=>{a.a(t,async(t,s)=>{try{a.d(e,{m:()=>n});var r=a(9487),c=t([r]);function i(t){return Number(t.toFixed(2))}async function n(t,e=new Map){let a=await (0,r.getFxRates)(),s=a.find(t=>"USDTRY"===t.pair)?.rate??32,c=a.find(t=>"EURTRY"===t.pair)?.rate??35,n=[...t].sort((t,e)=>t.date.localeCompare(e.date)||t.id-e.id),E=new Map;for(let t of n){let e=E.get(t.assetId)??{assetId:t.assetId,asset:t.asset,lots:[],lastKnownPrice:t.price,realizedPnL:0};if(e.lastKnownPrice=t.price,"BUY"===t.type)e.lots.push({quantity:t.quantity,unitCost:t.price}),E.set(t.assetId,e);else{let a=t.quantity,s=0;if(a>e.lots.reduce((t,e)=>t+e.quantity,0))throw Error(`Cannot sell ${t.quantity} ${t.asset.ticker}; insufficient quantity available.`);let r=e.lots.map(t=>({...t}));for(;a>1e-7;){let e=r[0];if(!e)throw Error(`FIFO inventory exhausted while processing ${t.asset.ticker}.`);let c=Math.min(a,e.quantity);s+=c*e.unitCost,e.quantity-=c,a-=c,e.quantity<=1e-7&&r.shift()}let c=t.quantity*t.price;e.lots=r,e.realizedPnL+=c-s,e.lots.length>0?E.set(t.assetId,e):E.delete(t.assetId)}}let u=Array.from(E.values()).map(t=>{let a=t.lots.reduce((t,e)=>t+e.quantity,0),r=t.lots.reduce((t,e)=>t+e.quantity*e.unitCost,0),n=e.get(t.assetId),E=n?.price??t.lastKnownPrice,u=n?.currency??t.asset.currency,T=E;u!==t.asset.currency&&("TRY"===u&&"USD"===t.asset.currency?T=E/s:"TRY"===u&&"EUR"===t.asset.currency?T=E/c:"USD"===u&&"TRY"===t.asset.currency?T=E*s:"EUR"===u&&"TRY"===t.asset.currency&&(T=E*c));let d=a*T,o=d-r,l=r>0?o/r:0;return{asset:t.asset,totalQuantity:i(a),averageCostBasis:i(a>0?r/a:0),currentPrice:i(T),currentValue:i(d),totalCost:i(r),unrealizedPnL:i(o),unrealizedPnLPercent:l,realizedPnL:i(t.realizedPnL)}}).filter(t=>t.totalQuantity>0).sort((t,e)=>e.currentValue-t.currentValue),T=u.reduce((t,e)=>"TRY"===e.asset.currency?t+e.currentValue:"USD"===e.asset.currency?t+e.currentValue*s:"EUR"===e.asset.currency?t+e.currentValue*c:t,0),d=u.reduce((t,e)=>"TRY"===e.asset.currency?t+e.totalCost:"USD"===e.asset.currency?t+e.totalCost*s:"EUR"===e.asset.currency?t+e.totalCost*c:t,0),o=u.reduce((t,e)=>"TRY"===e.asset.currency?t+e.realizedPnL:"USD"===e.asset.currency?t+e.realizedPnL*s:"EUR"===e.asset.currency?t+e.realizedPnL*c:t,0),l=T-d,R=o+l,N={totalValue:i(T),totalCostBasis:i(d),netInvested:i(d),realizedPnL:i(o),unrealizedPnL:i(l),totalReturn:i(R),totalReturnPercent:d>0?R/d:0};return{positions:u,history:[],summary:N}}r=(c.then?(await c)():c)[0],s()}catch(t){s(t)}})},9487:(t,e,a)=>{a.a(t,async(t,s)=>{try{a.r(e),a.d(e,{deleteAsset:()=>D,deleteTransaction:()=>q,getAssets:()=>A,getFxRate:()=>M,getFxRates:()=>f,getLastCachedPrice:()=>U,getLatestPrices:()=>C,getPortfolioSnapshot:()=>w,getPositionQuantity:()=>F,getTransactionCountByAsset:()=>m,getTransactions:()=>p,initDb:()=>R,insertAsset:()=>S,insertFxRate:()=>h,insertPriceCacheEntry:()=>O,insertTransaction:()=>I,updateAsset:()=>g,updateTransaction:()=>x});var r=a(7561),c=a.n(r),i=a(9411),n=a.n(i),E=a(4629),u=a(7880),T=t([E,u]);[E,u]=T.then?(await T)():T;let P=n().join(process.cwd(),"data");function d(){return global.portfolioDb||(global.portfolioDb=(0,E.createClient)({url:process.env.DATABASE_URL||"file:/app/data/portfolio.db"})),global.portfolioDb}n().join(P,"portfolio.db"),c().existsSync(P)||c().mkdirSync(P,{recursive:!0});let Y=null;async function o(){if(global.schemaInitialized)return;c().existsSync(P)||c().mkdirSync(P,{recursive:!0});let t=d();await t.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL CHECK(asset_class IN ('BIST', 'NASDAQ', 'FUND_TR', 'FUND_US', 'COMMODITY')),
      currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),await t.execute(`
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
  `);try{let e=await t.execute("SELECT sql FROM sqlite_master WHERE name='transactions'"),a=e.rows[0]?.sql;a&&!a.includes("'EUR'")&&(console.log("Running migration: Add EUR to transactions currency constraint"),await t.execute("PRAGMA foreign_keys=off"),await t.execute(`
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
      `),await t.execute(`
        INSERT INTO transactions_new (id, asset_id, type, quantity, price, currency, date, notes, created_at)
        SELECT id, asset_id, type, quantity, price, currency, date, notes, created_at FROM transactions
      `),await t.execute("DROP TABLE transactions"),await t.execute("ALTER TABLE transactions_new RENAME TO transactions"),await t.execute("PRAGMA foreign_keys=on"),console.log("Migration completed successfully"))}catch(e){console.error("Migration failed:",e),await t.execute("PRAGMA foreign_keys=on")}await t.execute(`
    CREATE TABLE IF NOT EXISTS price_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      price REAL NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('TRY', 'USD', 'EUR')),
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),await t.execute(`
    CREATE TABLE IF NOT EXISTS fx_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair TEXT NOT NULL UNIQUE,
      rate REAL NOT NULL,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),global.schemaInitialized=!0}async function l(){Y||(Y=o()),await Y}async function R(){let t=n().join(process.cwd(),"data");c().existsSync(t)||c().mkdirSync(t,{recursive:!0});let e=d();await e.execute(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    asset_class TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TRY',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`),await e.execute(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER REFERENCES assets(id),
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    currency TEXT NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`),await e.execute(`CREATE TABLE IF NOT EXISTS price_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER REFERENCES assets(id),
    price REAL NOT NULL,
    currency TEXT NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`),await e.execute(`CREATE TABLE IF NOT EXISTS fx_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    rate REAL NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)}function N(t){return{id:Number(t.id),ticker:String(t.ticker),name:String(t.name),assetClass:t.asset_class,currency:t.currency,createdAt:String(t.created_at)}}function y(t){return{id:Number(t.id),assetId:Number(t.asset_id),type:t.type,quantity:Number(t.quantity),price:Number(t.price),currency:t.currency,date:String(t.date),notes:t.notes?String(t.notes):null,createdAt:String(t.created_at)}}function L(t){return{id:Number(t.id),assetId:Number(t.asset_id),price:Number(t.price),currency:t.currency,fetchedAt:String(t.fetched_at)}}function _(t){return{id:Number(t.id),pair:String(t.pair),rate:Number(t.rate),fetchedAt:String(t.fetched_at)}}async function A(){await l();let t=d();return(await t.execute({sql:`SELECT id, ticker, name, asset_class, currency, created_at
          FROM assets
          ORDER BY ticker ASC`})).rows.map(N)}async function p(){await l();let t=d();return(await t.execute({sql:`SELECT
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
         ORDER BY t.date DESC, t.id DESC`})).rows.map(t=>({...y(t),asset:{id:Number(t.joined_asset_id),ticker:String(t.ticker),name:String(t.name),assetClass:t.asset_class,currency:t.asset_currency,createdAt:String(t.asset_created_at)}}))}async function S(t){await l();let e=d(),a=await e.execute({sql:`INSERT INTO assets (ticker, name, asset_class, currency)
          VALUES (?, ?, ?, ?)`,args:[t.ticker,t.name,t.assetClass,t.currency]}),s=a.lastInsertRowid?Number(a.lastInsertRowid):0,r=await e.execute({sql:`SELECT id, ticker, name, asset_class, currency, created_at
          FROM assets
          WHERE id = ?`,args:[s]});return N(r.rows[0])}async function I(t){await l();let e=d();if(!(await e.execute({sql:`SELECT id, ticker, name, asset_class, currency, created_at
          FROM assets
          WHERE id = ?`,args:[t.assetId]})).rows[0])throw Error("Selected asset does not exist.");let a=await e.execute({sql:`INSERT INTO transactions (asset_id, type, quantity, price, currency, date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,args:[t.assetId,t.type,t.quantity,t.price,t.currency,t.date,t.notes]}),s=a.lastInsertRowid?Number(a.lastInsertRowid):0,r=(await e.execute({sql:`SELECT
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
         WHERE t.id = ?`,args:[s]})).rows[0];return{...y(r),asset:{id:Number(r.joined_asset_id),ticker:String(r.ticker),name:String(r.name),assetClass:r.asset_class,currency:r.asset_currency,createdAt:String(r.asset_created_at)}}}async function w(){let t=await p(),e=await C();return await (0,u.m)(t,e)}async function C(){await l();let t=d(),e=await t.execute({sql:`SELECT pc.id, pc.asset_id, pc.price, pc.currency, pc.fetched_at
          FROM price_cache pc
          INNER JOIN (
            SELECT asset_id, MAX(fetched_at) AS max_fetched_at
            FROM price_cache
            GROUP BY asset_id
          ) latest
            ON latest.asset_id = pc.asset_id
           AND latest.max_fetched_at = pc.fetched_at`});return new Map(e.rows.map(t=>{let e=L(t);return[e.assetId,e]}))}async function U(t){await l();let e=d(),a=await e.execute({sql:`SELECT id, asset_id, price, currency, fetched_at
          FROM price_cache
          WHERE asset_id = ?
          ORDER BY fetched_at DESC, id DESC
          LIMIT 1`,args:[t]});return 0===a.rows.length?null:L(a.rows[0])}async function O(t,e,a){await l();let s=d(),r=await s.execute({sql:`INSERT INTO price_cache (asset_id, price, currency)
          VALUES (?, ?, ?)`,args:[t,e,a]}),c=r.lastInsertRowid?Number(r.lastInsertRowid):0,i=await s.execute({sql:`SELECT id, asset_id, price, currency, fetched_at
          FROM price_cache
          WHERE id = ?`,args:[c]});return L(i.rows[0])}async function f(){await l();let t=d();return(await t.execute({sql:`SELECT id, pair, rate, fetched_at
          FROM fx_rates
          ORDER BY pair ASC`})).rows.map(_)}async function M(t){await l();let e=d(),a=await e.execute({sql:`SELECT id, pair, rate, fetched_at
          FROM fx_rates
          WHERE pair = ?
          ORDER BY fetched_at DESC, id DESC
          LIMIT 1`,args:[t]});return 0===a.rows.length?null:_(a.rows[0])}async function h(t,e){await l();let a=d(),s=await a.execute({sql:`INSERT INTO fx_rates (pair, rate)
          VALUES (?, ?)`,args:[t,e]}),r=s.lastInsertRowid?Number(s.lastInsertRowid):0,c=await a.execute({sql:`SELECT id, pair, rate, fetched_at
          FROM fx_rates
          WHERE id = ?`,args:[r]});return _(c.rows[0])}async function g(t,e){await l();let a=d(),s=[],r=[];if(void 0!==e.name&&(s.push("name = ?"),r.push(e.name)),void 0!==e.assetClass&&(s.push("asset_class = ?"),r.push(e.assetClass)),void 0!==e.currency&&(s.push("currency = ?"),r.push(e.currency)),0===s.length)throw Error("No fields to update");r.push(t),await a.execute({sql:`UPDATE assets SET ${s.join(", ")} WHERE id = ?`,args:r});let c=await a.execute({sql:`SELECT id, ticker, name, asset_class, currency, created_at
          FROM assets
          WHERE id = ?`,args:[t]});return N(c.rows[0])}async function D(t){await l();let e=d();await e.execute({sql:"DELETE FROM transactions WHERE asset_id = ?",args:[t]}),await e.execute({sql:"DELETE FROM assets WHERE id = ?",args:[t]})}async function m(t){await l();let e=d(),a=await e.execute({sql:"SELECT COUNT(*) as count FROM transactions WHERE asset_id = ?",args:[t]});return Number(a.rows[0].count)}async function x(t,e){await l();let a=d(),s=[],r=[];if(void 0!==e.type&&(s.push("type = ?"),r.push(e.type)),void 0!==e.quantity&&(s.push("quantity = ?"),r.push(e.quantity)),void 0!==e.price&&(s.push("price = ?"),r.push(e.price)),void 0!==e.currency&&(s.push("currency = ?"),r.push(e.currency)),void 0!==e.date&&(s.push("date = ?"),r.push(e.date)),void 0!==e.notes&&(s.push("notes = ?"),r.push(e.notes)),0===s.length)throw Error("No fields to update");r.push(t),await a.execute({sql:`UPDATE transactions SET ${s.join(", ")} WHERE id = ?`,args:r});let c=(await a.execute({sql:`SELECT
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
         WHERE t.id = ?`,args:[t]})).rows[0];return{...y(c),asset:{id:Number(c.joined_asset_id),ticker:String(c.ticker),name:String(c.name),assetClass:c.asset_class,currency:c.asset_currency,createdAt:String(c.asset_created_at)}}}async function q(t){await l();let e=d();await e.execute({sql:"DELETE FROM transactions WHERE id = ?",args:[t]})}async function F(t){await l();let e=d(),a=await e.execute({sql:`SELECT COALESCE(SUM(CASE WHEN type = 'BUY' THEN quantity ELSE -quantity END), 0) as quantity
          FROM transactions
          WHERE asset_id = ?`,args:[t]});return Number(a.rows[0].quantity)}s()}catch(t){s(t)}})}};