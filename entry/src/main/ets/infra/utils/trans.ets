export function lengthToNumber(len: Length): number {
  if (typeof len === 'number') {
    return len;
  }

  // 2) 字符串
  if (typeof len === 'string') {
    const s: string = len;
    if (s.endsWith('vp')) {
      const v: number = parseFloat(s.slice(0, -2));
      return isNaN(v) ? 0 : v;
    }
    if (s.endsWith('px')) {
      const px: number = parseFloat(s.slice(0, -2));
      return isNaN(px) ? 0 : px;
    }
    if (s.endsWith('%')) {
      // 百分比无基准，按 0
      const p: number = parseFloat(s.slice(0, -1));
      return isNaN(p) ? 0 : p;
    }
    const v2: number = parseFloat(s);
    return isNaN(v2) ? 0 : v2;
  }

  // 3) Resource 分支：这里通常不会出现在 Area.width/height 的运行时值里，
  // 只是类型上允许；给一个安全兜底（返回 0），不会影响正常判断。
  // 如需精确解析 Resource 的数值，可再接入 resourceManager 取 dimen。
  return 0;
}

