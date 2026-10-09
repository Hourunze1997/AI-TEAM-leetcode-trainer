/**
 * 报价页状态：切档时 ensureQuoteItems 懒生成；items 按 category 分组；
 * updateItem 本地乐观更新 + 持久化；resetDefault 删后重生成；totals 派生汇总。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ensureQuoteItems,
  getQuoteTotals,
  resetQuoteItems,
  updateQuoteItem,
} from '../services/quoteService';
import { CATEGORY_ORDER } from '../templates/quoteTemplates';
import type { QuoteItem, QuoteLevel } from '../models/types';

export function useQuote(floorPlanId: string, totalAreaM2: number) {
  const [level, setLevelState] = useState<QuoteLevel>('standard');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 面积尚未就绪（0）时不生成，避免用错误面积生成数量
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (totalAreaM2 <= 0) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const rows = await ensureQuoteItems(floorPlanId, level, totalAreaM2);
        if (!cancelled) setItems(rows);
      } catch (e) {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [floorPlanId, level, totalAreaM2]);

  const setLevel = useCallback((l: QuoteLevel) => {
    setLevelState(l);
  }, []);

  /** items 按 CATEGORY_ORDER 分组 */
  const grouped = useMemo(() => {
    const map = new Map<string, QuoteItem[]>();
    for (const it of items) {
      const arr = map.get(it.category);
      if (arr) arr.push(it);
      else map.set(it.category, [it]);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c) as QuoteItem[],
    }));
  }, [items]);

  /** 本地乐观更新 subtotal，再持久化（失败时静默，等待下次同步） */
  const updateItem = useCallback(
    (id: string, patch: { unitPrice?: number; quantity?: number }) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          const unitPrice = patch.unitPrice !== undefined ? patch.unitPrice : it.unitPrice;
          const quantity = patch.quantity !== undefined ? patch.quantity : it.quantity;
          return {
            ...it,
            unitPrice,
            quantity,
            subtotal: Math.round(unitPrice * quantity * 100) / 100,
          };
        }),
      );
      updateQuoteItem(id, patch)
        .then((updated) => {
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
        })
        .catch(() => {});
    },
    [],
  );

  /** 恢复默认单价：删后按模板重生成 */
  const resetDefault = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await resetQuoteItems(floorPlanId, level, totalAreaM2);
      setItems(rows);
    } catch (e) {
      // 保留现有数据
    } finally {
      setLoading(false);
    }
  }, [floorPlanId, level, totalAreaM2]);

  const totals = useMemo(
    () => getQuoteTotals(items, totalAreaM2 > 0 ? totalAreaM2 : null),
    [items, totalAreaM2],
  );

  return { level, setLevel, grouped, updateItem, resetDefault, totals, loading };
}
