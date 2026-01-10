export interface Admiral {
  memberId: number;
  nickname: string;
  level: number;
  experience: number;
  maxShips: number;
  maxSlotItems: number;
  rank?: number;
  largeDockEnabled?: boolean;

  updatedAt: number;
  extras?: Record<string, unknown>;
}