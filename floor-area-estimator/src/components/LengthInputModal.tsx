/**
 * 标定第二点确认后的 Modal：输入线段真实长度（米），显示当前像素距离，确认提交。
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface Props {
  visible: boolean;
  pixelLength: number;
  onCancel: () => void;
  onSubmit: (realLengthM: number) => void;
}

export default function LengthInputModal({ visible, pixelLength, onCancel, onSubmit }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const handleSubmit = () => {
    const v = parseFloat(text);
    if (!isFinite(v) || v <= 0) {
      Alert.alert('输入无效', '请输入大于 0 的真实长度（米）');
      return;
    }
    onSubmit(v);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.mask}>
        <View style={styles.card}>
          <Text style={styles.title}>标定比例尺</Text>
          <Text style={styles.meta}>当前像素距离：{pixelLength.toFixed(1)} px</Text>
          <Text style={styles.label}>这条线在现实中的长度（米）</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            keyboardType="numeric"
            placeholder="如：3.6"
            placeholderTextColor="#9CA3AF"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={styles.btnGhostText}>取消</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSubmit}>
              <Text style={styles.btnPrimaryText}>确定</Text>
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
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: '#FF4D1C',
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
    fontSize: 16,
    color: '#111827',
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
});
