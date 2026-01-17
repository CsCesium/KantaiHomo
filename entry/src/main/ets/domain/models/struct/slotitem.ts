export interface SlotItem {
  uid: number;
  masterId: number;
  locked: boolean;
  level?: number;
  alv?: number;
  updatedAt: number;
  extras?: Record<string, unknown>;
}

export interface UnsetSlot {
  byType3No: Record<number, number[]>;
  updatedAt: number;
}