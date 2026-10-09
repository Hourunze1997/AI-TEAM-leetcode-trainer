/**
 * 报价项服务：
 * - ensureQuoteItems：该 (项目, 档次) 无数据时按 QUOTE_TEMPLATES 生成，否则直接返回
 * - updateQuoteItem：改单价/数量并重算 subtotal
 * - resetQuoteItems：删后按模板重新生成（恢复默认单价）
 * - getQuoteTotals：汇总总额与每平米造价
 */
import { getDb } from '../db/database';
import { QUOTE_TEMPLATES, quantityFor } from '../templates/quoteTemplates';
import { uuid } from '../utils/uuid';
import type { QuoteItem, QuoteLevel } from '../models/types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rowToItem(row: Record<string, unknown>): QuoteItem {
  return {
    id: String(row.id),
    floorPlanId: String(row.floor_plan_id),
    level: String(row.level) as QuoteLevel,
    category: String(row.category),
    name: String(row.name),
    unit: String(row.unit),
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    subtotal: Number(row.subtotal),
  };
}

/** 汇总：Σsubtotal；perM2 = total / totalAreaM2（面积缺失或为 0 返回 null） */
export function getQuoteTotals(
  items: QuoteItem[],
  totalAreaM2: number | null,
): { total: number; perM2: number | null } {
  const total = round2(items.reduce((sum, it) => sum + (it.subtotal || 0), 0));
  const perM2 = totalAreaM2 && totalAreaM2 > 0 ? round2(total / totalAreaM2) : null;
  return { total, perM2 };
}

/** 按 (项目, 档次) 查询报价项（按插入顺序，与模板分组顺序一致） */
export async function listQuoteItems(
  floorPlanId: string,
  level: QuoteLevel,
): Promise<QuoteItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM quote_items WHERE floor_plan_id = ? AND level = ? ORDER BY rowid ASC',
    [floorPlanId, level],
  );
  return rows.map(rowToItem);
}

/** 按模板生成该档全部报价项并落库 */
async function generateQuoteItems(
  floorPlanId: string,
  level: QuoteLevel,
  totalAreaM2: number,
): Promise<QuoteItem[]> {
  const templates = QUOTE_TEMPLATES[level] ?? [];
  const rows: QuoteItem[] = templates.map((t) => {
    const quantity = quantityFor(t.unit, totalAreaM2);
    return {
      id: uuid(),
      floorPlanId,
      level,
      category: t.category,
      name: t.name,
      unit: t.unit,
      unitPrice: t.defaultPrice,
      quantity,
      subtotal: round2(t.defaultPrice * quantity),
    };
  });
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      await db.runAsync(
        `INSERT INTO quote_items
          (id, floor_plan_id, level, category, name, unit, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.floorPlanId, r.level, r.category, r.name, r.unit, r.unitPrice, r.quantity, r.subtotal],
      );
    }
  });
  return rows;
}

/** 该档无数据时按模板生成并落库，否则直接返回现有数据（懒生成） */
export async function ensureQuoteItems(
  floorPlanId: string,
  level: QuoteLevel,
  totalAreaM2: number,
): Promise<QuoteItem[]> {
  const existing = await listQuoteItems(floorPlanId, level);
  if (existing.length > 0) return existing;
  return generateQuoteItems(floorPlanId, level, totalAreaM2);
}

/** 更新单价/数量并重算 subtotal，返回更新后的完整项 */
export async function updateQuoteItem(
  id: string,
  patch: { unitPrice?: number; quantity?: number },
): Promise<QuoteItem> {
  const db = getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM quote_items WHERE id = ?',
    [id],
  );
  if (!row) throw new Error('报价项不存在');

  const unitPrice = patch.unitPrice !== undefined ? patch.unitPrice : Number(row.unit_price);
  const quantity = patch.quantity !== undefined ? patch.quantity : Number(row.quantity);
  if (!isFinite(unitPrice) || unitPrice < 0) throw new Error('单价无效');
  if (!isFinite(quantity) || quantity <= 0) throw new Error('数量必须大于 0');

  const subtotal = round2(unitPrice * quantity);
  await db.runAsync(
    'UPDATE quote_items SET unit_price = ?, quantity = ?, subtotal = ? WHERE id = ?',
    [unitPrice, quantity, subtotal, id],
  );
  return {
    id: String(row.id),
    floorPlanId: String(row.floor_plan_id),
    level: String(row.level) as QuoteLevel,
    category: String(row.category),
    name: String(row.name),
    unit: String(row.unit),
    unitPrice,
    quantity,
    subtotal,
  };
}

/** 恢复默认：删除该档现有项后按模板重新生成 */
export async function resetQuoteItems(
  floorPlanId: string,
  level: QuoteLevel,
  totalAreaM2: number,
): Promise<QuoteItem[]> {
  const db = getDb();
  await db.runAsync('DELETE FROM quote_items WHERE floor_plan_id = ? AND level = ?', [
    floorPlanId,
    level,
  ]);
  return generateQuoteItems(floorPlanId, level, totalAreaM2);
}
