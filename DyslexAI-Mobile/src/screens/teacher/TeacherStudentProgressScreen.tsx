import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getTeacherCombinedProgress, listTeacherStudents, type TeacherCombinedProgressResponse, type TeacherStudent } from '../../api/assignments';
import { getStudentStats, type StudentStats } from '../../api/exercises';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TeacherStudentProgressScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [loadingStudents, setLoadingStudents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [combined, setCombined] = useState<TeacherCombinedProgressResponse | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<StudentStats | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const selectedDisplay = useMemo(() => {
    if (!selectedStats) return null;
    return {
      avg: selectedStats.average_score,
      sessions: selectedStats.total_sessions,
      wordsPracticed: selectedStats.total_words_practiced,
      mastered: selectedStats.words_mastered.length,
      struggling: selectedStats.words_struggling.length,
    };
  }, [selectedStats]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setLoadingStudents(true);
      setError(null);
      try {
        const [list, comb] = await Promise.all([
          listTeacherStudents({ teacherId: user.id }),
          getTeacherCombinedProgress({ teacherId: user.id }),
        ]);
        if (cancelled) return;
        setStudents(list);
        setCombined(comb);
        setSelectedId(list[0]?.id ?? null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load progress');
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadStudent() {
      if (!user || !selectedId) return;
      setSelectedLoading(true);
      try {
        const stats = await getStudentStats(selectedId);
        if (cancelled) return;
        setSelectedStats(stats);
      } catch (e) {
        if (cancelled) return;
        Alert.alert('Failed to load student stats', e instanceof Error ? e.message : 'Unknown error');
        setSelectedStats(null);
      } finally {
        if (!cancelled) setSelectedLoading(false);
      }
    }
    void loadStudent();
    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MaterialIcons name="insights" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Student Progress</Text>
          <Text style={styles.sub}>Combined overview + individual drill-down</Text>
        </View>
      </View>

      {loadingStudents ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Loading students…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loadingStudents && students.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No students linked to your assignments yet.</Text>
        </View>
      ) : null}

      {!loadingStudents && combined ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Combined Progress</Text>
          <Text style={styles.big}>
            {combined.avg_score == null ? '—' : `${Math.round(combined.avg_score * 100)}%`}
          </Text>
          <Text style={styles.muted}>Total sessions: {combined.total_sessions}</Text>
          <Text style={styles.mini}>Students: {students.length}</Text>
        </View>
      ) : null}

      {students.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Students</Text>
          {students.map((s) => {
            const active = selectedId === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.studentRow, active && styles.studentRowActive]}
                onPress={() => setSelectedId(s.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.studentName, active && styles.studentNameActive]} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.studentMeta}>{s.age ? `Age ${s.age}` : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {selectedId ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Details</Text>
          <View style={styles.detailCard}>
            {selectedLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>Loading…</Text>
              </View>
            ) : selectedDisplay ? (
              <>
                <Text style={styles.detailBig}>
                  {selectedDisplay.avg == null ? '—' : `${Math.round(selectedDisplay.avg * 100)}%`}
                </Text>
                <Text style={styles.muted}>Sessions: {selectedDisplay.sessions}</Text>
                <Text style={styles.mini}>Words practiced: {selectedDisplay.wordsPracticed}</Text>
                <View style={styles.badgesRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeLabel}>Mastered</Text>
                    <Text style={styles.badgeValue}>{selectedDisplay.mastered}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeLabel}>Struggling</Text>
                    <Text style={styles.badgeValue}>{selectedDisplay.struggling}</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.muted}>No stats yet for this student.</Text>
            )}
          </View>
          <TouchableOpacity style={styles.backHint} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: fonts.semiBold },
  sub: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, marginTop: 2, lineHeight: 18 },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
  muted: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 18 },

  errorBox: {
    backgroundColor: 'rgba(244, 67, 54, 0.12)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.35)',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: 'rgb(244, 67, 54)', fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: 14, color: colors.text, fontFamily: fonts.semiBold, marginBottom: spacing.xs },
  big: { fontSize: 30, fontFamily: fonts.bold, color: colors.primary, marginBottom: spacing.xs },
  mini: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular, marginTop: spacing.xs },

  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 15, color: colors.text, fontFamily: fonts.semiBold, marginBottom: spacing.sm },

  studentRow: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  studentName: { fontSize: 14, color: colors.text, fontFamily: fonts.semiBold, flex: 1, marginRight: spacing.sm },
  studentNameActive: { color: colors.primary },
  studentMeta: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular },

  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailBig: { fontSize: 28, fontFamily: fonts.bold, color: colors.primary, marginBottom: spacing.xs },

  badgesRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  badge: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  badgeLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: spacing.xs },
  badgeValue: { fontSize: 18, color: colors.text, fontFamily: fonts.semiBold },

  backHint: { alignItems: 'center', marginTop: spacing.sm },
  backText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13 },
});

