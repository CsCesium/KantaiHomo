/**
 * 航空战攻击机图标的着色矩阵。
 *
 * 图标是黑色剪影 PNG（app.media.airplane_windows8，grayscale + alpha，gray = 0），
 * 靠 4x5 颜色矩阵重新着色：清零 RGB 乘数、用平移列写入目标颜色、alpha 行原样透传。
 *
 * 关键点：平移列（每行第 5 个）是 0.0-1.0 归一化的，不是 0-255。
 * 直接填 0-255 的整数会让三个通道全部 clamp 到 1.0，图标变成纯白，敌我无法区分。
 */
const CHANNEL_MAX = 255;

export function silhouetteTintMatrix(hex: string): number[] {
  const color: number = Number.parseInt(hex.slice(1), 16);
  const r: number = ((color >> 16) & CHANNEL_MAX) / CHANNEL_MAX;
  const g: number = ((color >> 8) & CHANNEL_MAX) / CHANNEL_MAX;
  const b: number = (color & CHANNEL_MAX) / CHANNEL_MAX;
  return [
    0, 0, 0, 0, r,
    0, 0, 0, 0, g,
    0, 0, 0, 0, b,
    0, 0, 0, 1, 0,
  ];
}
