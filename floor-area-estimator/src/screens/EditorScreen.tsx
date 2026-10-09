/**
 * 图纸编辑页：ZoomableCanvas 内渲染底图 + SVG 覆盖层（CalibrationLayer + PolygonLayer）；
 * 根据 useEditor 的 tool 把 onTapImage 分发到标定/绘制流程；
 * 控制 LengthInputModal 与 RoomNameModal；头部实时显示面积提示。
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import ZoomableCanvas from '../components/ZoomableCanvas';
import CalibrationLayer from '../components/CalibrationLayer';
import PolygonLayer from '../components/PolygonLayer';
import ToolBar from '../components/ToolBar';
import LengthInputModal from '../components/LengthInputModal';
import RoomNameModal from '../components/RoomNameModal';
import { useEditor } from '../hooks/useEditor';
import { distance, polygonAreaM2 } from '../geometry/geometry';
import { errMsg, formatM2 } from '../utils/format';
import type { Point, RoomType } from '../models/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

export default function EditorScreen({ route, navigation }: Props) {
  const { floorPlanId } = route.params;
  const ed = useEditor(floorPlanId);
  const { floorPlan, tool, currentPolygon, pendingCalibPoints, scaleReady } = ed;

  useEffect(() => {
    navigation.setOptions({
      title: floorPlan?.name ?? '图纸编辑',
      headerRight: () => (
        <Text
          style={styles.headerAction}
          onPress={() => navigation.navigate('AreaSummary', { floorPlanId })}
        >
          汇总
        </Text>
      ),
    });
  }, [navigation, floorPlan?.name, floorPlanId]);

  /** 画布 tap → 编辑器状态机 */
  const handleCanvasTap = useCallback(
    (p: Point) => {
      ed.handleTap(p);
    },
    [ed],
  );

  /** 闭合多边形：未标定时提示 */
  const handleClosePolygon = useCallback(() => {
    if (!scaleReady) {
      Alert.alert('提示', '请先标定比例尺');
      return;
    }
    ed.closePolygon();
  }, [ed, scaleReady]);

  /** 标定保存 */
  const handleSaveCalibration = useCallback(
    async (realLengthM: number) => {
      try {
        await ed.saveCalibration(realLengthM);
        Alert.alert('标定成功', '比例尺已更新，可以开始绘制房间了');
      } catch (e) {
        Alert.alert('标定失败', errMsg(e));
        ed.cancelCalibration();
      }
    },
    [ed],
  );

  /** 房间保存 */
  const handleSaveRoom = useCallback(
    async (name: string, type: RoomType) => {
      try {
        await ed.saveRoom(name, type);
      } catch (e) {
        Alert.alert('保存失败', errMsg(e));
      }
    },
    [ed],
  );

  /** 当前绘制多边形的预览面积（已标定时实时计算） */
  const previewArea = useMemo(() => {
    if (!floorPlan || !floorPlan.scalePxPerMeter) return 0;
    return polygonAreaM2(currentPolygon, floorPlan.scalePxPerMeter);
  }, [floorPlan, currentPolygon]);

  const pendingPixelLength = useMemo(() => {
    if (pendingCalibPoints.length !== 2) return 0;
    const [a, b] = pendingCalibPoints;
    return distance(a.x, a.y, b.x, b.y);
  }, [pendingCalibPoints]);

  if (!floorPlan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>加载图纸中…</Text>
      </View>
    );
  }

  const toolBarHint =
    tool === 'calibrate'
      ? '在图上沿一条已知长度的边点两个点'
      : tool === 'draw' && !scaleReady
        ? '请先标定比例尺，再绘制房间'
        : null;

  return (
    <View style={styles.container}>
      <View style={styles.infoBar}>
        <Text style={styles.infoText} numberOfLines={1}>
          {scaleReady && floorPlan.scalePxPerMeter
            ? `比例尺 ${floorPlan.scalePxPerMeter.toFixed(2)} px/m`
            : '未标定：请切到「标定」测量已知长度'}
        </Text>
        <Text style={[styles.infoText, styles.infoStrong]}>
          {currentPolygon.length >= 3 && scaleReady
            ? `当前 ${formatM2(previewArea)} · 累计 ${formatM2(ed.totalAreaM2)}`
            : `累计实得面积 ${formatM2(ed.totalAreaM2)}`}
        </Text>
      </View>

      <ZoomableCanvas imageUri={floorPlan.imageUri} onTapImage={handleCanvasTap}>
        {(info) => (
          <Svg
            width={info.width}
            height={info.height}
            viewBox={`0 0 ${info.imgW} ${info.imgH}`}
          >
            <PolygonLayer
              rooms={ed.rooms}
              currentPolygon={ed.currentPolygon}
              imgW={info.imgW}
            />
            <CalibrationLayer
              lines={ed.calibLines}
              pendingPoints={ed.pendingCalibPoints}
              imgW={info.imgW}
            />
          </Svg>
        )}
      </ZoomableCanvas>

      <ToolBar
        tool={ed.tool}
        onToolChange={ed.setTool}
        onUndo={ed.undo}
        onClosePolygon={handleClosePolygon}
        onRestart={ed.restart}
        canUndo={
          ed.tool === 'draw'
            ? ed.currentPolygon.length > 0
            : ed.tool === 'calibrate'
              ? ed.pendingCalibPoints.length > 0
              : false
        }
        canClose={ed.tool === 'draw' && ed.currentPolygon.length >= 3 && scaleReady}
        hint={toolBarHint}
      />

      <LengthInputModal
        visible={ed.awaitingLength}
        pixelLength={pendingPixelLength}
        onCancel={ed.cancelCalibration}
        onSubmit={handleSaveCalibration}
      />
      <RoomNameModal
        visible={ed.showRoomModal}
        defaultName={`房间 ${ed.rooms.length + 1}`}
        areaM2={previewArea}
        calibrated={scaleReady}
        onSave={handleSaveRoom}
        onCancel={() => ed.setShowRoomModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
  },
  infoStrong: {
    flex: 0,
    color: '#111827',
    fontWeight: '700',
    marginLeft: 10,
  },
  headerAction: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 14,
  },
});
