export interface ParsedSupplierNote {
  supplierOrderId: string | null;
  costPrice: number;
}

function isSupplierIdLine(line: string): boolean {
  return /^\d{10,}$/.test(line);
}

function isPriceLine(line: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(line) && !isSupplierIdLine(line);
}

function extractLoose(trimmed: string): ParsedSupplierNote {
  const longId = trimmed.match(/\d{10,}/)?.[0] ?? null;
  const priceMatch = trimmed.match(/(?<!\d)(\d{1,6}\.\d{1,2})(?!\d)/) ?? trimmed.match(/(?<!\d)(\d{1,4})(?!\d)/);
  const costRaw = priceMatch ? Number.parseFloat(priceMatch[1]) : NaN;
  const costPrice =
    Number.isFinite(costRaw) && costRaw >= 0 && !(longId && priceMatch?.[1] === longId)
      ? Math.round(costRaw * 100) / 100
      : 0;

  return {
    supplierOrderId: longId ?? trimmed.slice(0, 120),
    costPrice,
  };
}

/** Parse seller "My note" — accepts any note; extracts id/price when present. */
export function parseSupplierNote(raw: string | null | undefined): ParsedSupplierNote | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  const sameLine = normalized.match(/(\d{10,})\s+(\d+(?:\.\d+)?)/);
  if (sameLine) {
    const costPrice = Number.parseFloat(sameLine[2]);
    if (Number.isFinite(costPrice) && costPrice >= 0) {
      return { supplierOrderId: sameLine[1], costPrice };
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const supplierIds = lines.filter(isSupplierIdLine);
  const prices = lines.filter(isPriceLine).map((line) => Number.parseFloat(line));

  if (supplierIds.length >= 1 && prices.length >= 1) {
    const costPrice = Math.round(prices.reduce((sum, price) => sum + price, 0) * 100) / 100;
    if (Number.isFinite(costPrice) && costPrice >= 0) {
      return {
        supplierOrderId: supplierIds.join(", "),
        costPrice,
      };
    }
  }

  if (lines.length >= 2) {
    const supplierOrderId = lines[0].match(/(\d{10,})/)?.[1];
    const costPrice = Number.parseFloat(lines[1].replace(/[^\d.]/g, ""));
    if (supplierOrderId && Number.isFinite(costPrice) && costPrice >= 0) {
      return { supplierOrderId, costPrice };
    }
  }

  return extractLoose(trimmed);
}
