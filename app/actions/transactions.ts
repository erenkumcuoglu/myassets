"use server";

import { revalidatePath } from "next/cache";
import { getAssets, getTransactions, insertAsset, insertTransaction } from "@/lib/db";
import type { AssetClass, Currency, TransactionType } from "@/types";

export async function addTransaction(formData: FormData) {
  const assetId = Number(formData.get("assetId"));
  const type = formData.get("type") as TransactionType;
  const quantity = Number(formData.get("quantity"));
  const price = Number(formData.get("price"));
  const currency = formData.get("currency") as Currency;
  const date = formData.get("date") as string;
  const notes = formData.get("notes") as string;

  // Validation
  if (quantity <= 0) {
    return { error: "Quantity must be greater than 0" };
  }

  if (price <= 0) {
    return { error: "Price must be greater than 0" };
  }

  if (!date) {
    return { error: "Date is required" };
  }

  const transactionDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (transactionDate > today) {
    return { error: "Date cannot be in the future" };
  }

  // For SELL, validate that user has enough quantity
  if (type === "SELL") {
    const transactions = await getTransactions();
    const assetTransactions = transactions.filter((t) => t.assetId === assetId);
    
    let totalQuantity = 0;
    for (const t of assetTransactions) {
      if (t.type === "BUY") {
        totalQuantity += t.quantity;
      } else {
        totalQuantity -= t.quantity;
      }
    }

    if (quantity > totalQuantity) {
      return { error: `Insufficient quantity. You have ${totalQuantity.toFixed(2)} units available.` };
    }
  }

  try {
    await insertTransaction({
      assetId,
      type,
      quantity,
      price,
      currency,
      date,
      notes: notes || null,
    });

    revalidatePath("/portfolio");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");

    return { success: true };
  } catch (error) {
    console.error("Failed to add transaction:", error);
    return { error: "Failed to add transaction" };
  }
}

export async function addAsset(formData: FormData) {
  const ticker = formData.get("ticker") as string;
  const name = formData.get("name") as string;
  const assetClass = formData.get("assetClass") as AssetClass;
  const currency = formData.get("currency") as Currency;

  if (!ticker || !name) {
    return { error: "Ticker and name are required" };
  }

  try {
    const asset = await insertAsset({
      ticker: ticker.toUpperCase(),
      name,
      assetClass,
      currency,
    });

    return { success: true, asset };
  } catch (error) {
    console.error("Failed to add asset:", error);
    return { error: "Failed to add asset" };
  }
}
