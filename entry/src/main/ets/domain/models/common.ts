export interface StatPair {
  current: number;
  max: number;
}
export interface ApiResponse<T> {
  api_result: number;
  api_result_msg: string;
  api_data: T;
}
export const nowMs = (): number => Date.now();