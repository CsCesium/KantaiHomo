export interface UseItemStack {
  itemId: number;
  count: number;
  updatedAt: number;
  extras?: Record<string, unknown>;
}