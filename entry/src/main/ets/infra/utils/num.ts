export function i32(x: any, def: number): number {
  const n: number = Number(x)
  if (!Number.isFinite(n)) return def
  return (n | 0)
}

export function i64(x: any, def: number): number {
  const n: number = Number(x)
  if (!Number.isFinite(n)) return def
  return Math.trunc(n)
}

export function assertTsMs(ts: number, tag: string): boolean {
  if (!Number.isFinite(ts) || ts <= 0) {
    console.warn('[persist] invalid ts:', tag, ts)
    return false
  }
  return true
}