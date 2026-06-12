import { PanelColors } from './panelConfig';

/**
 * 制空状態 (api_disp_seiku) 的展示名称与颜色映射。
 * 供战斗预览头部与航空战详情面板共用。
 */

export function airStateName(s: number | undefined): string {
  if (s === 1) return '确保';
  if (s === 2) return '优势';
  if (s === 3) return '均衡';
  if (s === 4) return '劣势';
  if (s === 5) return '丧失';
  return '';
}

export function airStateColor(s: number | undefined): string {
  if (s === 1) return '#43a047';
  if (s === 2) return '#26c6da';
  if (s === 3) return PanelColors.txtSub;
  if (s === 4) return '#fb8c00';
  if (s === 5) return PanelColors.hpCrit;
  return PanelColors.txtMuted;
}
