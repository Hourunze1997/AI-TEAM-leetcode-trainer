/**
 * 报告导出页：等宽字体预览 buildReport 生成的文本报告，
 * 底部「分享/导出」按钮调用 shareReport 唤起系统分享。
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { buildReport, shareReport } from '../services/reportService';
import { errMsg } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export default function ReportScreen({ route }: Props) {
  const { floorPlanId, level } = route.params;
  const lv: 'basic' | 'standard' | 'premium' = level ?? 'standard';

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  // 每次聚焦重新生成，保证数据最新
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      buildReport(floorPlanId, lv)
        .then((t) => {
          if (!cancelled) setText(t);
        })
        .catch((e) => {
          if (!cancelled) setText(`报告生成失败：${errMsg(e)}`);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [floorPlanId, lv]),
  );

  const handleShare = async () => {
    if (!text || loading) return;
    try {
      setSharing(true);
      const fileName = `装修测算报告_${Date.now()}.txt`;
      await shareReport(text, fileName);
    } catch (e) {
      Alert.alert('分享失败', errMsg(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.previewWrap}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>正在生成报告…</Text>
          </View>
        ) : (
          <View style={styles.paper}>
            <Text style={[styles.reportText, { fontFamily: MONO }]} selectable>
              {text}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.shareBtn, (loading || sharing) && styles.disabled]}
          onPress={handleShare}
          disabled={loading || sharing}
        >
          <Text style={styles.shareBtnText}>{sharing ? '分享中…' : '分享 / 导出报告'}</Text>
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
  previewWrap: {
    padding: 16,
    paddingBottom: 32,
  },
  paper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  reportText: {
    fontSize: 12,
    lineHeight: 20,
    color: '#111827',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 14,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  shareBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
