// Standalone Vercel serverless function for TEFAS proxy
// This file is used for Vercel deployment only

const TEFAS_URL = "https://www.tefas.gov.tr/api/DB/BindHistoryInfo";

// Helper to format date as DD.MM.YYYY
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return {
    dateStr: `${day}.${month}.${year}`,
    isoDate: `${year}-${month}-${day}`,
  };
}

// Try to fetch price from TEFAS for a specific date
async function tryFetchTefas(fundCode, dateInfo) {
  const body = new URLSearchParams({
    fontip: "YAT",
    fonkod: fundCode.toUpperCase(),
    bastarih: dateInfo.dateStr,
    bittarih: dateInfo.dateStr,
  });

  const response = await fetch(TEFAS_UR// Standalone Vercel serverless function for TEFAS proxy
// This file is used for Vercel deployment only

const TEFAS_URL = "https://www.tefas.gov.pt// This file is used for Vercel deployment only

const .0
const TEFAS_URL = "https://www.tefas.gov.tr/aGec
// Helper to format date as DD.MM.YYYY
function getDateString(daysHttfunction getDateString(daysAgo) {
  cww  const date = new Date();
  datnK  date.setDate(date.getDa()  const day = String(date.getDate()).padov  const month = String(date.getMonth() + 1).padStart(!r  const year = date.getFullYear();
  return {
    dateStr: `po  return {
    dateStr: `${day}.$ot    dateSoc    isoDate: `${year}-${month}-${day}`)   };
}

// Try to fetch price from Got H}

 respasync function tryFetchTefas(fundCode, dateInfo) {
y   const body = new URLSearchParams({
    fontip:  r    fontip: "YAT",
    fonkod: fund
     fonkod: fundCri    bastarih: dateInfo.dateStr,
  ri    bittarih: dateInfo.dateStr",  });

  const response = awaitypeof nu// This file is used for Vercel deployment only

const TEFAS_URL = "https://www.tefas.gov.pt//er
const TEFAS_URL = "https://www.tefas.gov.pt//or(
const .0
const TEFAS_URL = "https://www.tefas.gov.tr/aGec
// Helper to format date as DDst const Tde// Helper to format date as DD.MM.YYYY
function"Afunction getDateString(daysHttfunctioPT  cww  const date = new Date();
eaders": "Content-Type",
};

exp  datnK  date.setDate(date.getdl  return {
    dateStr: `po  return {
    dateStr: `${day}.$ot    dateSoc    isoDate: `${year}-${month}-${day}`)   };
}

// Try to fetch price from Got H}

 respasy "    dateS      dateStr: `${day}.$ot rs}

// Try to fetch price from Got H}

 respasync function tryFetchTefas(fundCo    c
 respasync function tryFetchTef
  y   const body = new URLSearchParams({
    fontip:  r He    fontip:  r    fontip: "YAT",
    pa    fonkod: fund
     fonkod: f}
     fonkod: fute  ri    bittarih: dateInfo.dateStr",  });

  const d
  const response = awaitypeof nu// This   
const TEFAS_URL = "https://www.tefas.gov.pt//er
const TEFAS_URL = "https://Tryinconst TEFAS_URL ${dateInfo.dateStr}`);
      
  const .0
const TEFAS_URL = "https://www.tefas.gatconst T
 // Helper to format date as DDst const Tde// He  function"Afunction getDateString(daysHttfunctioPT  cww  const date = new Date()nfeaders": "Content-Type",
};

exp  datnK  date.setDate(date.getdl  return {
    e:};

exp  datnK  date.se  
       dateStr: `po  retu

    res.status(404).se    dateStr: `${day}.$oton(}

// Try to fetch price from Got H}

 respasy "    dateS      dateStr: `${dayerror
 respasy "    dateS  ", error);
  
// Try to fetch price from Got H}

 respasync f 
 
 respasync function tryFetchTefor  respasync function tryFetchTef
  y   const     y    }
}
