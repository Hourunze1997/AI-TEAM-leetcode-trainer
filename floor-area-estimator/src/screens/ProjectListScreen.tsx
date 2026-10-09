/**
 * 项目列表页：FlatList 渲染 ProjectCard；
 * 「新建项目」→ 相册/拍照选图 → 命名 Modal → 创建并跳转编辑页；
 * 卡片长按弹出 重命名/删除 操作菜单。
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import ProjectCard from '../components/ProjectCard';
import { useProjects } from '../hooks/useProjects';
import { errMsg } from '../utils/format';
import type { ProjectSummary } from '../models/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectList'>;

export default function ProjectListScreen({ navigation }: Props) {
  const { projects, loading, error, refresh, create, rename, remove } = useProjects();

  const [sourceModal, setSourceModal] = useState(false);
  const [nameModal, setNameModal] = useState(false);
  const [nameMode, setNameMode] = useState<'create' | 'rename'>('create');
  const [nameDraft, setNameDraft] = useState('');
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** 新建项目入口：先选择图片来源 */
  const handleCreateProject = () => {
    setSourceModal(true);
  };

  /** 经 expo-image-picker 选图（mediaTypes: Images），成功后进入命名 Modal */
  const pickImage = async (source: 'library' | 'camera') => {
    setSourceModal(false);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('权限不足', '请在系统设置中允许使用相机');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('权限不足', '请在系统设置中允许访问相册');
          return;
        }
      }
      const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 };
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      setPendingUri(res.assets[0].uri);
      setNameMode('create');
      setNameDraft(`户型项目 ${projects.length + 1}`);
      setNameModal(true);
    } catch (e) {
      Alert.alert('选图失败', errMsg(e));
    }
  };

  const confirmNameModal = async () => {
    const name = nameDraft.trim();
    if (!name) {
      Alert.alert('提示', '请输入名称');
      return;
    }
    try {
      setBusy(true);
      if (nameMode === 'create' && pendingUri) {
        const plan = await create(name, pendingUri);
        setNameModal(false);
        setPendingUri(null);
        navigation.navigate('Editor', { floorPlanId: plan.id });
      } else if (nameMode === 'rename' && renameId) {
        await rename(renameId, name);
        setNameModal(false);
        setRenameId(null);
      }
    } catch (e) {
      Alert.alert('操作失败', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (summary: ProjectSummary) => {
    Alert.alert(
      '删除项目',
      `确定删除「${summary.plan.name}」吗？\n房间、标定与报价数据将一并删除。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            remove(summary.plan.id).catch((e) => Alert.alert('删除失败', errMsg(e)));
          },
        },
      ],
    );
  };

  const handleLongPress = (summary: ProjectSummary) => {
    Alert.alert(summary.plan.name, '选择操作', [
      {
        text: '重命名',
        onPress: () => {
          setNameMode('rename');
          setRenameId(summary.plan.id);
          setNameDraft(summary.plan.name);
          setNameModal(true);
        },
      },
      { text: '删除', style: 'destructive', onPress: () => confirmDelete(summary) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.createBtn} onPress={handleCreateProject}>
          <Text style={styles.createBtnText}>＋ 新建项目</Text>
        </Pressable>
        <Text style={styles.headerTip}>选择户型图 → 标定比例尺 → 圈选房间自动算面积</Text>
      </View>

      {loading && projects.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.plan.id}
          renderItem={({ item }) => (
            <ProjectCard
              summary={item}
              onPress={() => navigation.navigate('Editor', { floorPlanId: item.plan.id })}
              onLongPress={() => handleLongPress(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {error ? `加载失败：${error}` : '还没有项目，点击「新建项目」开始吧'}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => refresh()} tintColor="#2563EB" />
          }
          contentContainerStyle={projects.length === 0 ? styles.listEmpty : styles.list}
        />
      )}

      {/* 图片来源选择 */}
      <Modal visible={sourceModal} transparent animationType="fade" onRequestClose={() => setSourceModal(false)}>
        <View style={styles.mask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>选择户型图来源</Text>
            <Pressable style={styles.optionBtn} onPress={() => pickImage('library')}>
              <Text style={styles.optionText}>从相册选择</Text>
            </Pressable>
            <Pressable style={styles.optionBtn} onPress={() => pickImage('camera')}>
              <Text style={styles.optionText}>拍照上传</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setSourceModal(false)}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 命名 Modal（新建 / 重命名共用） */}
      <Modal visible={nameModal} transparent animationType="fade" onRequestClose={() => setNameModal(false)}>
        <View style={styles.mask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {nameMode === 'create' ? '新建项目' : '重命名项目'}
            </Text>
            <TextInput
              style={styles.nameInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="输入项目名称"
              placeholderTextColor="#9CA3AF"
              maxLength={30}
              autoFocus
              onSubmitEditing={() => {
                if (!busy) confirmNameModal();
              }}
            />
            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setNameModal(false)}
                disabled={busy}
              >
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, busy && styles.disabled]}
                onPress={confirmNameModal}
                disabled={busy}
              >
                <Text style={styles.btnPrimaryText}>{busy ? '处理中…' : '确定'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  createBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTip: {
    marginTop: 8,
    fontSize: 12,
    color: '#9CA3AF',
  },
  list: {
    paddingBottom: 24,
  },
  listEmpty: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  mask: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  optionBtn: {
    backgroundColor: '#EEF1F5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  optionText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: '#111827',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
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
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  cancelText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
});
