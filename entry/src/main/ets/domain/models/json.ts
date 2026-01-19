export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface JsonObject {
  [k: string]: JsonValue;
}

export type JsonArray = JsonValue[];

// ---------- type guards & getters ----------
export function isObject(v: JsonValue): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function asObject(v: JsonValue): JsonObject | null {
  return isObject(v) ? (v as JsonObject) : null;
}

export function asArray(v: JsonValue): JsonArray | null {
  return Array.isArray(v) ? (v as JsonArray) : null;
}

export function getObj(o: JsonObject, key: string): JsonObject | null {
  const v: JsonValue = o[key];
  return v === undefined ? null : asObject(v as JsonValue);
}

export function getStr(o: JsonObject, key: string, def: string = ''): string {
  const v: JsonValue = o[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return `${v}`;
  return def;
}

export function getNum(o: JsonObject, key: string, def: number = 0): number {
  const v: JsonValue = o[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  return def;
}

export  function unwrapApiData(root: JsonObject): JsonObject {
  const v: JsonValue = root['api_data']
  if (v !== undefined) {
    const o: JsonObject | null = asObject(v)
    if (o !== null) return o
  }
  return root
}