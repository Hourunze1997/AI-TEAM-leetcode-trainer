/**
 * 编辑页状态机（编辑页全部状态与动作的单一来源）：
 * - tool：view / calibrate / draw
 * - 标定：收集两点 → awaitingLength → saveCalibration(真实米数)
 * - 绘制：追加顶点 → closePolygon(≥3 点) → saveRoom(命名+类型)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFloorPlan } from '../services/floorPlanService';
import {
  addCalibrationLine,
  listCalibrationLines,
} from '../services/calibrationService';
import {
  deleteRoom as deleteRoomService,
  listRooms,
  saveRoom as saveRoomService,
} from '../services/roomService';
import type {
  CalibrationLine,
  FloorPlan,
  Point,
  Room,
  RoomType,
  Tool,
} from '../models/types';

export function useEditor(floorPlanId: string) {
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [calibLines, setCalibLines] = useState<CalibrationLine[]>([]);
  const [tool, setToolState] = useState<Tool>('view');
  const [pendingCalibPoints, setPendingCalibPoints] = useState<Point[]>([]);
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);
  const [awaitingLength, setAwaitingLength] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);

  /** 重新加载项目 / 房间 / 标定线 */
  const reload = useCallback(async () => {
    try {
      const plan = await getFloorPlan(floorPlanId);
      setFloorPlan(plan);
      if (plan) {
        setRooms(await listRooms(floorPlanId));
        setCalibLines(await listCalibrationLines(floorPlanId));
      }
    } catch (e) {
      // 加载失败时保留现有状态
    }
  }, [floorPlanId]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** 切换工具：离开标定模式时清空待标定点 */
  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    if (t !== 'calibrate') {
      setPendingCalibPoints([]);
      setAwaitingLength(false);
    }
  }, []);

  /** 画布 tap 分发：标定收集两点后置 awaitingLength；绘制追加顶点 */
  const handleTap = useCallback(
    (p: Point) => {
      if (tool === 'calibrate') {
        if (awaitingLength) return;
        setPendingCalibPoints((prev) => {
          if (prev.length >= 2) return prev;
          const next = [...prev, p];
          if (next.length === 2) setAwaitingLength(true);
          return next;
        });
      } else if (tool === 'draw') {
        if (showRoomModal) return;
        setCurrentPolygon((prev) => [...prev, p]);
      }
      // view 模式不响应落点
    },
    [tool, awaitingLength, showRoomModal],
  );

  /** 撤销：绘制撤最后顶点；标定撤最后待选点 */
  const undo = useCallback(() => {
    if (tool === 'draw' && currentPolygon.length > 0) {
      setCurrentPolygon((prev) => prev.slice(0, -1));
    } else if (tool === 'calibrate' && pendingCalibPoints.length > 0) {
      if (pendingCalibPoints.length === 2) setAwaitingLength(false);
      setPendingCalibPoints((prev) => prev.slice(0, -1));
    }
  }, [tool, currentPolygon.length, pendingCalibPoints.length]);

  /** 闭合多边形：≥3 点才弹命名框 */
  const closePolygon = useCallback(() => {
    if (currentPolygon.length < 3) return;
    setShowRoomModal(true);
  }, [currentPolygon.length]);

  /** 重新开始：清空绘制中的多边形 */
  const restart = useCallback(() => {
    setCurrentPolygon([]);
    setShowRoomModal(false);
  }, []);

  /** 保存标定：两点 + 真实长度 → 写库并刷新 scale */
  const saveCalibration = useCallback(
    async (realLengthM: number) => {
      if (pendingCalibPoints.length !== 2) return;
      const [a, b] = pendingCalibPoints;
      await addCalibrationLine(floorPlanId, a.x, a.y, b.x, b.y, realLengthM);
      setPendingCalibPoints([]);
      setAwaitingLength(false);
      setToolState('view');
      await reload();
    },
    [pendingCalibPoints, floorPlanId, reload],
  );

  /** 取消标定 */
  const cancelCalibration = useCallback(() => {
    setPendingCalibPoints([]);
    setAwaitingLength(false);
  }, []);

  /** 保存房间（需已标定），成功后清空绘制并刷新 */
  const saveRoom = useCallback(
    async (name: string, type: RoomType) => {
      if (currentPolygon.length < 3) {
        setShowRoomModal(false);
        return;
      }
      await saveRoomService({
        floorPlanId,
        name: name.trim() || '未命名房间',
        type,
        polygon: currentPolygon,
      });
      setCurrentPolygon([]);
      setShowRoomModal(false);
      setToolState('view');
      await reload();
    },
    [currentPolygon, floorPlanId, reload],
  );

  /** 删除房间 */
  const deleteRoom = useCallback(
    async (id: string) => {
      await deleteRoomService(id);
      await reload();
    },
    [reload],
  );

  const totalAreaM2 = useMemo(
    () => Math.round(rooms.reduce((s, r) => s + (r.areaM2 || 0), 0) * 100) / 100,
    [rooms],
  );

  const scaleReady = !!(floorPlan && floorPlan.scalePxPerMeter && floorPlan.scalePxPerMeter > 0);

  return {
    floorPlan,
    rooms,
    calibLines,
    tool,
    setTool,
    pendingCalibPoints,
    currentPolygon,
    handleTap,
    undo,
    closePolygon,
    restart,
    saveRoom,
    deleteRoom,
    awaitingLength,
    saveCalibration,
    cancelCalibration,
    showRoomModal,
    setShowRoomModal,
    totalAreaM2,
    scaleReady,
    reload,
  };
}
