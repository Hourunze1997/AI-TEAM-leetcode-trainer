/**
 * 报告服务：拼装纯文本报告（面积清单 + 得房率 + 分档预算明细与汇总），
 * 写入 cacheDirectory 后经 expo-sharing 唤起系统分享面板。
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getFloorPlan } from './floorPlanService';
import { listRooms } from './roomService';
import { ensureQuoteItems, getQuoteTotals } from './quoteService';
import { CATEGORY_ORDER, LEVEL_LABELS } from '../templates/quoteTemplates';
import { ROOM_TYPE_LABELS } from '../models/types';
import type { QuoteLevel } from '../models/types';

function padEnd(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 生成「项目名+日期+面积清单+得房率+分档预算明细+总额/每平米造价」的纯文本报告 */
export async function buildReport(floorPlanId: string, level: QuoteLevel): Promise<string> {
  const plan = await getFloorPlan(floorPlanId);
  if (!plan) throw new Error('项目不存在');

  const rooms = await listRooms(floorPlanId);
  const totalArea = rooms.reduce((s, r) => s + (r.areaM2 || 0), 0);
  const lines: string[] = [];
  const divider = '———————————————';

  lines.push('装 修 测 算 报 告');
  lines.push(divider);
  lines.push(`项目名称：${plan.name}`);
  lines.push(`生成时间：${formatDateTime(new Date())}`);
  lines.push('');
  lines.push('【房间面积清单】');
  if (rooms.length === 0) {
    lines.push('  （暂无房间数据，请在编辑页绘制房间）');
  } else {
    for (const r of rooms) {
      lines.push(
        `  ${padEnd(r.name, 12)}${padEnd(ROOM_TYPE_LABELS[r.type] ?? '其他', 6)}${r.areaM2.toFixed(2)} ㎡`,
      );
    }
  }
  lines.push(`  实得总面积：${totalArea.toFixed(2)} ㎡`);
  if (plan.buildingAreaM2 && plan.buildingAreaM2 > 0) {
    lines.push(`  建筑面积：${plan.buildingAreaM2.toFixed(2)} ㎡`);
    lines.push(`  得房率：${((totalArea / plan.buildingAreaM2) * 100).toFixed(1)}%`);
  } else {
    lines.push('  得房率：--（未填写建筑面积）');
  }
  lines.push('');

  lines.push(`【装修预算明细 · ${LEVEL_LABELS[level]}】`);
  const items = await ensureQuoteItems(floorPlanId, level, totalArea);
  if (items.length === 0) {
    lines.push('  （暂无报价数据）');
  }
  for (const cat of CATEGORY_ORDER) {
    const rows = items.filter((i) => i.category === cat);
    if (rows.length === 0) continue;
    lines.push(`■ ${cat}`);
    for (const it of rows) {
      const unitLabel = it.unit.replace('元/', '');
      lines.push(
        `  ${padEnd(it.name, 14)}¥${it.unitPrice}/${padEnd(unitLabel, 4)} × ${it.quantity} = ¥${it.subtotal.toFixed(2)}`,
      );
    }
  }
  const totals = getQuoteTotals(items, totalArea > 0 ? totalArea : null);
  lines.push('');
  lines.push(`预算总额：¥${totals.total.toFixed(2)}`);
  lines.push(`每平米造价：${totals.perM2 !== null ? `¥${totals.perM2.toFixed(2)}/㎡` : '--'}`);
  lines.push('');

  lines.push('【三档预算对比】');
  for (const lv of ['basic', 'standard', 'premium'] as QuoteLevel[]) {
    const its = await ensureQuoteItems(floorPlanId, lv, totalArea);
    const t = getQuoteTotals(its, null);
    lines.push(`  ${padEnd(LEVEL_LABELS[lv], 6)}¥${t.total.toFixed(2)}`);
  }
  lines.push(divider);
  lines.push('本报告由「户型面积估算助手」生成，价格为行业参考价，仅供模拟估算。');
  return lines.join('\n');
}

/** 写入 cacheDirectory 后经系统分享面板分享（mimeType: text/plain） */
export async function shareReport(text: string, fileName: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('当前设备不支持分享功能');
  }
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const fileUri = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(fileUri, text, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/plain',
    dialogTitle: '分享装修测算报告',
    UTI: 'public.plain-text',
  });
}
