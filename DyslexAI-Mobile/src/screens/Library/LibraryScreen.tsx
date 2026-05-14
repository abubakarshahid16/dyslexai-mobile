import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSavedScans, deleteSavedScan } from '../../utils/libraryStorage';
import type { SavedScan } from '../../types/library';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diff = now.getTime() - ms;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

function snippet(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim() + '…';
}

export default function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<SavedScan[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await getSavedScans();
    setItems(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleOpen = (item: SavedScan) => {
    navigation.navigate('ScanResults', {
      imageUri: item.imageUri,
      rawText: item.rawText,
      correctedText: item.correctedText,
      lineCount: item.lineCount,
      lines: item.lines,
    });
  };

  const handleDelete = (item: SavedScan) => {
    Alert.alert(
      'Remove from Library',
      'Remove this saved scan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteSavedScan(item.id);
            load();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: SavedScan }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleOpen(item)}
      activeOpacity={0.85}
    >
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <MaterialIcons name="document-scanner" size={32} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.snippet} numberOfLines={2}>
          {snippet(item.correctedText, 80)}
        </Text>
        <Text style={styles.date}>{formatDate(item.savedAt)}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item)}
        hitSlop={12}
      >
        <MaterialIcons name="delete-outline" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <MaterialIcons name="menu-book" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No saved scans yet</Text>
        <Text style={styles.emptySub}>
          After a scan, tap "Save to Library" to keep it here.
        </Text>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => navigation.navigate('Upload')}
        >
          <Text style={styles.scanBtnText}>Scan now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  thumb: { width: 72, height: 72 },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, padding: spacing.sm },
  snippet: { fontSize: 14, color: colors.text, lineHeight: 20, fontFamily: fonts.regular },
  date: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontFamily: fonts.regular },
  deleteBtn: { padding: spacing.sm },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: spacing.md, fontFamily: fonts.semiBold },
  emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', fontFamily: fonts.regular },
  scanBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  scanBtnText: { color: colors.text, fontWeight: '600', fontFamily: fonts.semiBold },
});
