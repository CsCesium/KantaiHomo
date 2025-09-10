import { BusinessError } from '@kit.BasicServicesKit';

export function errorToStr(
  e: BusinessError | Error | string | number | boolean | object | null | undefined
): string {
  if (typeof e === 'string') return e;
  if (typeof e === 'number') return String(e);
  if (typeof e === 'boolean') return e ? 'true' : 'false';
  if (e === null || e === undefined) return 'null';
  if (typeof e === 'object') {
    const beMsg: string = (e as BusinessError).message;
    if (typeof beMsg === 'string' && beMsg.length > 0) return beMsg;
    const erMsg: string = (e as Error).message;
    if (typeof erMsg === 'string' && erMsg.length > 0) return erMsg;
    try { return JSON.stringify(e); } catch { return 'error'; }
  }
  return 'error';
}