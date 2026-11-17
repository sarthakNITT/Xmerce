export type Availability = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

/** At or below this many units, a variant is shown as low on stock. */
export const LOW_STOCK_MAX = 5;

/**
 * Availability is always computed from live stock with this function and is
 * never stored: 0 is out of stock, 1 to 5 is low stock, more is in stock.
 */
export function availabilityOf(stock: number): Availability {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_MAX) return "LOW_STOCK";
  return "IN_STOCK";
}
