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

export function numAt(values: number[], index: number): number {
  if (index >= 0 && index < values.length) return values[index];
  return 0;
}
