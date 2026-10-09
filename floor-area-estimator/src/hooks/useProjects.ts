/**
 * 项目列表状态：load/refresh/create/rename/remove，暴露 loading 与错误信息。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  createFloorPlan,
  deleteFloorPlan,
  listFloorPlans,
  renameFloorPlan,
} from '../services/floorPlanService';
import type { ProjectSummary } from '../models/types';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listFloorPlans();
      setProjects(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 新建项目并刷新列表，返回新建的 FloorPlan */
  const create = useCallback(
    async (name: string, imageUri: string) => {
      const plan = await createFloorPlan({ name, imageUri });
      await load();
      return plan;
    },
    [load],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameFloorPlan(id, name);
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteFloorPlan(id);
      await load();
    },
    [load],
  );

  return { projects, loading, error, refresh: load, create, rename, remove };
}
