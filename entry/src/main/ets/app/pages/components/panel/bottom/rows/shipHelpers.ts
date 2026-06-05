import { MapGaugeInfo, ShipItem } from '../../../../../../features/panel/type';
import { PanelColors } from '../../../../../../features/panel/panelConfig';
import { isShipEscaped, MapGaugeSnapshot } from '../../../../../../features/state';

export function condColor(cond: number): string {
  if (cond > 50) return '#F6C64A';
  if (cond > 30) return '#FFFFFF';
  if (cond >= 20) return '#FF9F43';
  return '#FF5A5A';
}

export function getShipStatusText(ship: ShipItem): string {
  if (isShipEscaped(ship.id)) return '退避';
  return `◆${ship.s1}`;
}

export function getShipStatusColor(ship: ShipItem): string {
  if (isShipEscaped(ship.id)) return PanelColors.escapeLabel;
  return condColor(ship.s1);
}

export function getMapGaugeInfo(gauge: MapGaugeSnapshot): MapGaugeInfo {
  const areaNo = Math.floor(gauge.mapId / 10);
  const mapNo = gauge.mapId % 10;
  const hpNow = gauge.hpNow ?? 0;
  const hpMax = gauge.hpMax ?? 1;
  const ratio = hpMax > 0 ? hpNow / hpMax : 0;
  const isDefeatGauge = gauge.hpMax === null && gauge.requiredDefeats !== null;
  return {
    label: `${areaNo}-${mapNo}`,
    gaugeLabel: isDefeatGauge ? '回' : (gauge.gaugeType === 2 ? 'TP' : 'HP'),
    hpNow,
    hpMax,
    ratio,
    barColor: ratio > 0.5 ? PanelColors.hpOk : ratio > 0.25 ? PanelColors.hpWarn : PanelColors.hpCrit,
  };
}

/**
 * 周期性刷新的地图 = 常规海域 EO（每月重置）；非周期性 = 活动海图（一次性）。
 *
 * 区分方式：常规 EO 位于常规海域且没有 hpMax，只有 defeatCount/requiredDefeats。
 * 即使常规 EO 当前已通关，也保留显示，因为下个月仍会重置；活动海图斩杀后隐藏。
 */
export function isPeriodicMapGauge(gauge: MapGaugeSnapshot): boolean {
  const areaNo = Math.floor(gauge.mapId / 10);
  return gauge.hpMax === null && areaNo >= 1 && areaNo <= 7;
}

export function shouldDisplayMapGauge(gauge: MapGaugeSnapshot): boolean {
  return !gauge.cleared || isPeriodicMapGauge(gauge);
}

/** 是否为该 gauge 显示血条 / 进度条。活动图按 HP，EO 按击破次数。 */
export function shouldShowMapGaugeBar(gauge: MapGaugeSnapshot): boolean {
  if (gauge.hpMax !== null && gauge.hpMax > 0) return true;
  if (gauge.requiredDefeats !== null && gauge.requiredDefeats > 0) return true;
  return false;
}

export function getRemainingDefeatCount(gauge: MapGaugeSnapshot): number {
  const required = gauge.requiredDefeats ?? 0;
  if (required <= 0) return 0;
  const defeated = Math.min(Math.max(gauge.defeatCount, 0), required);
  return required - defeated;
}

/**
 * EO 击破次数 < 10 时改为格子风格（每格 = 1 次击破），≥ 10 时退化为线性条。
 * 活动 HP 条始终走线性条。
 */
export function isGridStyleMapGauge(gauge: MapGaugeSnapshot): boolean {
  if (gauge.hpMax !== null) return false;
  const required = gauge.requiredDefeats ?? 0;
  return required > 0 && required < 10;
}

/** 进度条数值 [当前, 总量]；颜色固定，不随比例变化。 */
export interface MapGaugeBarValues {
  value: number;
  total: number;
}

export function getMapGaugeBarValues(gauge: MapGaugeSnapshot): MapGaugeBarValues {
  if (gauge.hpMax !== null && gauge.hpMax > 0) {
    const info = getMapGaugeInfo(gauge);
    return { value: info.hpNow, total: info.hpMax };
  }
  const required = gauge.requiredDefeats ?? 0;
  return { value: getRemainingDefeatCount(gauge), total: required };
}

/** 生成 [0, 1, ..., n-1] 用于 ForEach 渲染格子。 */
export function rangeIndices(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
}

export function numAt(values: number[], index: number): number {
  if (index >= 0 && index < values.length) return values[index];
  return 0;
}
