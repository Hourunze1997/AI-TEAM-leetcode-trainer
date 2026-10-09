/**
 * 面积汇总页：房间面积清单（行尾删除）、实得总面积卡片、
 * 建筑面积输入与得房率实时计算、底部「装修报价模拟」入口。
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import SummaryCard from '../components/SummaryCard';
import { getFloorPlan } from '../services/floorPlanService';
import { listRooms, deleteRoom } from '../services/roomService';
import { updateBuildingArea } from '../services/floorPlanService';
import { ROOM_TYPE_LABELS } from '../models/types';
import type { FloorPlan, Room } from '../models/types';
import { errMsg, formatM2, formatRate } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'AreaSummary'>;

export default function AreaSummaryScreen({ route, navigation }: Props) {
  const { floorPlanId } = route.params;
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildingText, setBuildingText] = useState('');

  // 每次聚焦都刷新（编辑页可能新增/删除了房间）
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const p = await getFloorPlan(floorPlanId);
          const rs = await listRooms(floorPlanId);
          if (cancelled) return;
          setPlan(p);
          setRooms(rs);
          setBuildingText(p && p.buildingAreaM2 !== null ? String(p.buildingAreaM2) : '');
        } catch (e) {
          Alert.alert('加载失败', errMsg(e));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [floorPlanId]),
  );

  useEffectOnceTitle(plan, navigation);

  const totalAreaM2 = useMemo(
    () => Math.round(rooms.reduce((s, r) => s + (r.areaM2 || 0), 0) * 100) / 100,
    [rooms],
  );

  /** 建筑面积实时解析（输入过程中即时反映得房率） */
  const buildingM2 = useMemo(() => {
    const v = parseFloat(buildingText);
    return isFinite(v) && v > 0 ? v : null;
  }, [buildingText]);

  /** 输入过程只更新本地状态（实时计算），失焦/提交时持久化 */
  const handleBuildingAreaChange = (text: string) => {
    setBuildingText(text);
  };

  const persistBuildingArea = useCallback(
    (text: string) => {
      const v = parseFloat(text);
      const val = isFinite(v) && v > 0 ? v : null;
      updateBuildingArea(floorPlanId, val).catch(() => {});
    },
    [floorPlanId],
  );

  const reload = useCallback(async () => {
    const rs = await listRooms(floorPlanId);
    setRooms(rs);
  }, [floorPlanId]);

  const handleDeleteRoom = (room: Room) => {
    Alert.alert('删除房间', `确定删除「${room.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteRoom(room.id)
            .then(reload)
            .catch((e) => Alert.alert('删除失败', errMsg(e)));
        },
      },
    ]);
  };

  const rateText = formatRate(totalAreaM2, buildingM2);

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.cardsRow}>
            <SummaryCard title="实得总面积" value={formatM2(totalAreaM2)} subtitle={`共 ${rooms.length} 个房间`} />
            <SummaryCard
              title="得房率"
              value={rateText}
              subtitle={
                buildingM2 ? `建筑面积 ${buildingM2.toFixed(2)} ㎡` : '请填写建筑面积'
              }
              tone="primary"
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.roomRow}>
            <View style={styles.roomInfo}>
              <Text style={styles.roomName}>{item.name}</Text>
              <Text style={styles.roomType}>{ROOM_TYPE_LABELS[item.type] ?? '其他'}</Text>
            </View>
            <Text style={styles.roomArea}>{formatM2(item.areaM2)}</Text>
            <Pressable hitSlop={8} style={styles.delBtn} onPress={() => handleDeleteRoom(item)}>
              <Text style={styles.delText}>删除</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>还没有房间数据，去编辑页圈选房间吧</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.buildingCard}>
            <Text style={styles.buildingLabel}>建筑面积（㎡）</Text>
            <TextInput
              style={styles.buildingInput}
              value={buildingText}
              onChangeText={handleBuildingAreaChange}
              onEndEditing={() => persistBuildingArea(buildingText)}
              keyboardType="numeric"
              placeholder="如 100"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.buildingTip}>用于计算得房率，留空显示 --</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Pressable
          style={styles.quoteBtn}
          onPress={() => navigation.navigate('Quote', { floorPlanId })}
        >
          <Text style={styles.quoteBtnText}>装修报价模拟 →</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 把项目名同步到导航栏标题 */
function useEffectOnceTitle(plan: FloorPlan | null, navigation: { setOptions: (o: object) => void }) {
  React.useEffect(() => {
    if (plan?.name) {
      navigation.setOptions({ title: `${plan.name} · 面积汇总` });
    }
  }, [plan?.name, navigation]);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  list: {
    paddingBottom: 24,
  },
  cardsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 10,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  roomType: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  roomArea: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
    marginRight: 10,
  },
  delBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  delText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  buildingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  buildingLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  buildingInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
  },
  buildingTip: {
    marginTop: 6,
    fontSize: 11,
    color: '#9CA3AF',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  quoteBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  quoteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
