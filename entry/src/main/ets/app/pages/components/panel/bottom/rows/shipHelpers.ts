import { MapGaugeInfo, ShipItem } from '../../../../../../features/panel/type';
import { PanelColors } from '../../../../../../features/panel/panelConfig';
import { isShipEscaped, MapGaugeSnapshot } from '../../../../../../features/state';

export function condColor(cond: number): string {
  if (cond >= 50) return '#FFD700';
  if (cond >= 40) return PanelColors.txtSub;
  if (cond >= 30) return PanelColors.hpWarn;
  return PanelColors.hpCrit;
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
  return {
    label: `${areaNo}-${mapNo}`,
    gaugeLabel: gauge.gaugeType === 2 ? 'TP' : 'HP',
    hpNow,
    hpMax,
    ratio,
    barColor: ratio > 0.5 ? PanelColors.hpOk : ratio > 0.25 ? PanelColors.hpWarn : PanelColors.hpCrit,
  };
}

/**
 * 周期性刷新的地图 = 常规海域 EO（每月重置）；非周期性 = 活动海图（一次性）。
 *
 * 区分方式：活动海图通过 api_eventmap 提供 hpMax/hpNow，常规海图（含月度 EO）
 * 没有 hpMax，只有 defeatCount。这样即使常规海图当前已通关，也保留显示，
 * 因为下个月仍会重置；活动海图斩杀后则可以隐藏。
 */
export function isPeriodicMapGauge(gauge: MapGaugeSnapshot): boolean {
  return gauge.hpMax === null;
}

/** 是否为该 gauge 显示血条 / 进度条。活动图按 HP，EO 按击破次数。 */
export function shouldShowMapGaugeBar(gauge: MapGaugeSnapshot): boolean {
  if (gauge.hpMax !== null && gauge.hpMax > 0) return true;
  if (gauge.requiredDefeats !== null && gauge.requiredDefeats > 0) return true;
  return false;
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
  const defeated = Math.min(gauge.defeatCount, required);
  return { value: defeated, total: required };
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
