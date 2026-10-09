/** 统一展示格式化工具 */

/** 面积：两位小数 + ㎡；无效值返回 -- */
export function formatM2(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '--';
  return `${n.toFixed(2)} ㎡`;
}

/** 金额：千分位 + ¥ 前缀 */
export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '--';
  return `¥${Math.round(n).toLocaleString('en-US')}`;
}

/** 得房率 = 实得面积 / 建筑面积；建筑面积缺失返回 -- */
export function formatRate(
  actualM2: number | null | undefined,
  buildingM2: number | null | undefined,
): string {
  if (!actualM2 || !buildingM2 || buildingM2 <= 0) return '--';
  return `${((actualM2 / buildingM2) * 100).toFixed(1)}%`;
}

/** 统一错误信息提取 */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
