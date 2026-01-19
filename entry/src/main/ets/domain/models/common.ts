export interface StatPair {
  current: number;
  max: number;
}
export interface ApiResponse<T> {
  api_result: number;
  api_result_msg: string;
  api_data: T;
}
export type ApiResult = 0 | 1;
export type ApiMaybeEnvelope<T> = T | ApiResponse<T>;
export type ApiHpArray = Array<number | null>; // sometimes null appears
export type ApiFlagArray = Array<number | null>;
export type ApiNumArray = Array<number | null>;
export type ApiNum2D = Array<Array<number | null> | null>;

export interface ApiFormationRaw {
  /** [friendFormation, enemyFormation, engagement] */
  api_formation: number[];
}
export const nowMs = (): number => Date.now();

