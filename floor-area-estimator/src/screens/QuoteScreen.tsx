/**
 * 装修报价页：三档切换（basic/standard/premium），按 category 分组渲染 QuoteItemRow；
 * 底部固定汇总区（预算总额、每平米造价）与「恢复默认单价」按钮；
 * 右上角可跳转报告页。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import QuoteItemRow from '../components/QuoteItemRow';
import SummaryCard from '../components/SummaryCard';
import { useQuote } from '../hooks/useQuote';
import { listRooms } from '../services/roomService';
import { LEVEL_LABELS } from '../templates/quoteTemplates';
import type { QuoteLevel } from '../models/types';
import { errMsg, formatMoney } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Quote'>;

const LEVELS: QuoteLevel[] = ['basic', 'standard', 'premium'];

export default function QuoteScreen({ route, navigation }: Props) {
  const { floorPlanId, level: initialLevel } = route.params;
  const [totalAreaM2, setTotalAreaM2] = useState(0);
  const quote = useQuote(floorPlanId, totalAreaM2);
  const initialLevelRef = useRef<QuoteLevel | undefined>(initialLevel);

  // 每次聚焦刷新面积（编辑页可能新增房间）
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listRooms(floorPlanId)
        .then((rs) => {
          if (!cancelled) {
            const total = rs.reduce((s, r) => s + (r.areaM2 || 0), 0);
            setTotalAreaM2(Math.round(total * 100) / 100);
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [floorPlanId]),
  );

  // 从外部携带的初始档位
  useEffect(() => {
    if (initialLevelRef.current) {
      quote.setLevel(initialLevelRef.current);
      initialLevelRef.current = undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Text
          style={styles.headerAction}
          onPress={() => navigation.navigate('Report', { floorPlanId, level: quote.level })}
        >
          报告
        </Text>
      ),
    });
  }, [navigation, floorPlanId, quote.level]);

  const handleResetDefault = () => {
    Alert.alert('恢复默认单价', `将删除当前「${LEVEL_LABELS[quote.level]}」的修改并按模板重新生成，确定吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: () => {
          quote.resetDefault().catch((e) => Alert.alert('操作失败', errMsg(e)));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* 三档切换 */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {LEVELS.map((l) => {
            const active = quote.level === l;
            return (
              <Pressable
                key={l}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => quote.setLevel(l)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {LEVEL_LABELS[l]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {totalAreaM2 <= 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>尚未绘制房间（实得面积为 0），请先在编辑页圈选房间。</Text>
          </View>
        ) : quote.grouped.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {quote.loading ? '报价生成中…' : '暂无报价数据'}
            </Text>
          </View>
        ) : (
          quote.grouped.map((section) => (
            <View key={section.category} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{section.category}</Text>
              {section.items.map((it) => (
                <QuoteItemRow
                  key={it.id}
                  item={it}
                  onChange={(patch) => quote.updateItem(it.id, patch)}
                />
              ))}
            </View>
          ))
        )}
        {quote.loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : null}
      </ScrollView>

      {/* 底部固定汇总 */}
      <View style={styles.footer}>
        <View style={styles.footerCards}>
          <SummaryCard
            title="预算总额"
            value={formatMoney(quote.totals.total)}
            subtitle={LEVEL_LABELS[quote.level]}
            tone="primary"
          />
          <SummaryCard
            title="每平米造价"
            value={quote.totals.perM2 !== null ? formatMoney(quote.totals.perM2) : '--'}
            subtitle="按实得面积"
          />
        </View>
        <Pressable style={styles.resetBtn} onPress={handleResetDefault}>
          <Text style={styles.resetBtnText}>恢复默认单价</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  segmentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F5',
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#2563EB',
  },
  segmentText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footer: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  footerCards: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  resetBtn: {
    backgroundColor: '#EEF1F5',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  headerAction: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600',
  },
});
