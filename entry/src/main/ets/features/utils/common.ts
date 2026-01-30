/**
 * 通用工具函数
 *
 */

// ==================== Response 解析 ====================

/**
 * 解析 svdata 格式的响应
 * 处理 "svdata=" 前缀和 JSON 解析
 */
export function parseSvdata<T = any>(text: string | null | undefined): T | null {
  if (!text) return null;
  if (typeof text === 'object') return text as T;

  try {
    const s = text.startsWith('svdata=') ? text.slice(7) : text;
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * 从响应中提取 api_data
 * 支持多种响应结构
 */
export function extractApiData<T = any>(text: string | null | undefined): T | null {
  const obj = parseSvdata<any>(text);
  if (!obj) return null;

  // 标准结构: { api_result, api_result_msg, api_data }
  if (obj.api_data !== undefined) return obj.api_data as T;

  // 嵌套结构: { data: { api_data } }
  if (obj.data?.api_data !== undefined) return obj.data.api_data as T;

  return obj as T;
}

/**
 * 从各种 dump 格式中提取 API 对象
 * 兼容多种数据源格式
 */
export function extractKcsApiObject(dump: any): any | null {
  const raw =
    dump?.data ??
      dump?.responseBody ??
      dump?.body ??
      dump?.text ??
      dump?.resp ??
      dump?.responseText;

  const obj = parseSvdata(raw);
  if (!obj) return null;

  // 常见结构：{ api_result, api_result_msg, api_data }
  if (obj.api_data != null) return obj;

  // 有些封装可能是 { data: { api_result... } }
  if (obj.data && obj.data.api_data != null) return obj.data;

  return obj;
}

// ==================== Request 解析 ====================

/**
 * 表单参数封装类
 * 提供类似 URLSearchParams 的 API
 */
export class FormParams {
  private params: Map<string, string>;

  constructor(body: string | null | undefined) {
    this.params = new Map();
    if (!body) return;

    try {
      const pairs = body.split('&');
      for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          const key = decodeURIComponent(pair.slice(0, eqIdx));
          const value = decodeURIComponent(pair.slice(eqIdx + 1));
          this.params.set(key, value);
        } else if (pair) {
          this.params.set(decodeURIComponent(pair), '');
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  get(key: string): string | undefined {
    return this.params.get(key);
  }

  getInt(key: string, defaultValue = 0): number {
    const value = this.params.get(key);
    if (value === undefined) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  getFloat(key: string, defaultValue = 0): number {
    const value = this.params.get(key);
    if (value === undefined) return defaultValue;
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }

  getString(key: string, defaultValue = ''): string {
    return this.params.get(key) ?? defaultValue;
  }

  has(key: string): boolean {
    return this.params.has(key);
  }

  toRecord(): Record<string, string> {
    const obj: Record<string, string> = {};
    this.params.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
}

/**
 * 解析 URL 编码的表单请求体
 * 返回 FormParams 实例（兼容 .get() 方法）
 */
export function parseFormBody(body: string | null | undefined): FormParams {
  return new FormParams(body);
}

/**
 * 解析 URL 编码的表单请求体
 * 返回键值对 Record
 */
export function parseFormBodyToRecord(body: string | null | undefined): Record<string, string> {
  return new FormParams(body).toRecord();
}

/**
 * 从请求体中获取指定参数的整数值
 */
export function getFormInt(body: string | null | undefined, key: string, defaultValue = 0): number {
  return new FormParams(body).getInt(key, defaultValue);
}

/**
 * 从请求体中获取指定参数的字符串值
 */
export function getFormStr(body: string | null | undefined, key: string, defaultValue = ''): string {
  return new FormParams(body).getString(key, defaultValue);
}

// ==================== URL 解析 ====================

/**
 * 从 URL 中提取 API 路径
 * 例如: "/kcsapi/api_port/port?xxx" -> "api_port/port"
 */
export function extractApiPath(url: string): string {
  if (!url) return '';
  const match = url.match(/\/kcsapi\/(.+?)(?:\?|$)/);
  return match ? match[1] : '';
}

/**
 * 从 URL 中提取完整的 API 端点路径
 * 例如: "/kcsapi/api_port/port?xxx" -> "/kcsapi/api_port/port"
 */
export function extractEndpoint(url: string): string {
  if (!url) return '';
  const qIdx = url.indexOf('?');
  return qIdx > 0 ? url.slice(0, qIdx) : url;
}

/**
 * 检查 URL 是否匹配指定的 API 端点
 */
export function matchEndpoint(url: string, endpoint: string): boolean {
  return url.includes(endpoint);
}

/**
 * 检查 URL 是否匹配任一正则模式
 */
export function matchAnyPattern(url: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(url));
}

/**
 * 检查 URL 是否匹配任一端点字符串
 */
export function matchAnyEndpoint(url: string, endpoints: string[]): string | null {
  for (const ep of endpoints) {
    if (url.includes(ep)) return ep;
  }
  return null;
}

// ==================== Event ID 生成 ====================

/**
 * 从多个部分生成事件 ID
 * 用于事件去重
 */
export function makeEventId(parts: Array<string | number>): string {
  return parts.join('|');
}

/**
 * 生成唯一的事件 ID
 * 基于时间戳和随机数
 */
export function generateEventId(prefix = 'ev'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 生成带时间戳的事件 ID
 */
export function generateTimestampedId(prefix: string, timestamp: number): string {
  return `${prefix}_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ==================== 数组工具 ====================

/**
 * 安全获取数组，非数组返回空数组
 */
export function safeArr<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

/**
 * 安全获取数字数组
 */
export function safeNumArr(v: any): number[] {
  if (!Array.isArray(v)) return [];
  return v.map(item => (typeof item === 'number' ? item : 0));
}

/**
 * 跳过 dummy head 的数组 (游戏 API 中常见的 -1 或 0 开头)
 * 例如: [-1, 100, 200, 300] -> [100, 200, 300]
 *
 * 游戏 API 特点：
 * - 单舰队：长度 7，头部 -1
 * - 联合舰队：长度 13，头部 -1
 * - 有时头部为 0
 */
export function skipDummyHead(arr: any): number[] {
  const nums = safeNumArr(arr);
  if (nums.length === 0) return nums;

  const head = nums[0];
  // 检查常见的 dummy head 模式
  if (head === -1 || head === 0) {
    // 单舰队 (1+6) 或 联合舰队 (1+12) 或其他带 dummy 的数组
    if (nums.length === 7 || nums.length === 13 || nums.length === 12) {
      return nums.slice(1);
    }
  }

  return nums;
}

/**
 * 获取数组中有效的元素（过滤掉 -1 和 0）
 */
export function filterValidIds(arr: any): number[] {
  return safeNumArr(arr).filter(v => v > 0);
}

/**
 * 安全获取数组指定索引的元素
 */
export function safeGet<T>(arr: T[] | null | undefined, index: number, defaultValue: T): T {
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index] ?? defaultValue;
}

// ==================== 数值工具 ====================

/**
 * 安全获取整数
 */
export function safeInt(v: any, defaultValue = 0): number {
  if (typeof v === 'number' && !isNaN(v)) return Math.floor(v);
  if (typeof v === 'string') {
    const num = parseInt(v, 10);
    return isNaN(num) ? defaultValue : num;
  }
  return defaultValue;
}

/**
 * 安全获取浮点数
 */
export function safeFloat(v: any, defaultValue = 0): number {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const num = parseFloat(v);
    return isNaN(num) ? defaultValue : num;
  }
  return defaultValue;
}

/**
 * 安全获取布尔值
 */
export function safeBool(v: any, defaultValue = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return defaultValue;
}

/**
 * 安全获取字符串
 */
export function safeStr(v: any, defaultValue = ''): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return defaultValue;
  return String(v);
}

/**
 * 限制数值在指定范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ==================== 对象工具 ====================

/**
 * 安全获取嵌套属性
 */
export function getPath<T = any>(obj: any, path: string, defaultValue?: T): T | undefined {
  if (!obj || typeof obj !== 'object') return defaultValue;

  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue;
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * 从对象中提取指定的键
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

// ==================== 类型检查 ====================

/**
 * 检查是否是非空对象
 */
export function isObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 检查是否是非空字符串
 */
export function isNonEmptyString(v: any): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * 检查是否是有效数字
 */
export function isValidNumber(v: any): v is number {
  return typeof v === 'number' && !isNaN(v) && isFinite(v);
}

/**
 * 检查是否是正整数
 */
export function isPositiveInt(v: any): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

// ==================== 时间工具 ====================

/**
 * 获取当前时间戳 (毫秒)
 */
export function now(): number {
  return Date.now();
}

/**
 * 将秒转换为毫秒
 */
export function secToMs(sec: number): number {
  return sec * 1000;
}

/**
 * 将毫秒转换为秒
 */
export function msToSec(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * 解析游戏 API 中的完成时间
 * API 返回的时间可能是毫秒或特殊格式
 */
export function parseCompleteTime(v: any): number {
  if (typeof v === 'number') {
    // 如果小于某个阈值，认为是秒而不是毫秒
    return v > 1e12 ? v : v * 1000;
  }
  return 0;
}
