/**
 * 闭合多边形后的 Modal：房间名称输入 + 类型 chips + 预览面积 + 保存/取消。
 * 未标定时禁用保存并给出提示。
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ROOM_TYPE_LABELS } from '../models/types';
import type { RoomType } from '../models/types';
import { formatM2 } from '../utils/format';

interface Props {
  visible: boolean;
  defaultName: string;
  areaM2: number;
  calibrated: boolean;
  onSave: (name: string, type: RoomType) => void;
  onCancel: () => void;
}

const TYPES = Object.keys(ROOM_TYPE_LABELS) as RoomType[];

export default function RoomNameModal({
  visible,
  defaultName,
  areaM2,
  calibrated,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [type, setType] = useState<RoomType>('bedroom');

  useEffect(() => {
    if (visible) {
      setName(defaultName);
      setType('bedroom');
    }
  }, [visible, defaultName]);

  const canSave = calibrated && name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave(name.trim(), type);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.mask}>
        <View style={styles.card}>
          <Text style={styles.title}>保存房间</Text>
          <Text style={styles.areaPreview}>预览面积：{formatM2(areaM2)}</Text>

          <Text style={styles.label}>房间名称</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="如：主卧"
            placeholderTextColor="#9CA3AF"
            maxLength={20}
          />

          <Text style={styles.label}>房间类型</Text>
          <View style={styles.chips}>
            {TYPES.map((t) => {
              const active = type === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {ROOM_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!calibrated ? (
            <Text style={styles.warning}>⚠️ 尚未标定比例尺，请先在「标定」模式完成标定</Text>
          ) : null}

          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={styles.btnGhostText}>取消</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, !canSave && styles.disabled]}
              disabled={!canSave}
              onPress={handleSave}
            >
              <Text style={styles.btnPrimaryText}>保存</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  areaPreview: {
    marginTop: 6,
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  label: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 13,
    color: '#6B7280',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#EEF1F5',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#2563EB',
  },
  chipText: {
    color: '#4B5563',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  warning: {
    marginTop: 12,
    color: '#D97706',
    fontSize: 12,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    marginLeft: 10,
  },
  btnGhost: {
    backgroundColor: '#EEF1F5',
  },
  btnGhostText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
});
