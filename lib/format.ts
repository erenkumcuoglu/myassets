const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatNumberWithCommas(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value);
}

export function formatCurrency(value: number) {
  return formatCurrencyByCode(value, "USD");
}

export function formatCompactCurrency(value: number) {
  return formatCompactCurrencyByCode(value, "USD");
}

export function formatCurrencyByCode(value: number, currency: "USD" | "TRY" | "EUR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(value);
}

export function formatCompactCurrencyByCode(
  value: number,
  currency: "USD" | "TRY" | "EUR",
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
    useGrouping: true,
  }).format(value);
}

export function formatPercent(value: number) {
  return percentFormatter.format(value);
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}
