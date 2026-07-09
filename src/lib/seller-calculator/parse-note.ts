export interface ParsedSupplierNote {
  supplierOrderId: string;
  costPrice: number;
}

/** Parse seller "My note" like `3074386016281530 2.79` or on two lines. */
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

  if (lines.length >= 2) {
    const supplierOrderId = lines[0].match(/(\d{10,})/)?.[1];
    const costPrice = Number.parseFloat(lines[1].replace(/[^\d.]/g, ""));
    if (supplierOrderId && Number.isFinite(costPrice) && costPrice >= 0) {
      return { supplierOrderId, costPrice };
    }
  }

  return null;
}
