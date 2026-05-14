import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { listAssignments, getAssignment, type AssignmentDetail, type AssignmentListItem } from '../../api/assignments';

export default function TeacherAssignmentsScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const items = await listAssignments({ teacherId: user.id });
        if (cancelled) return;
        setAssignments(items);

        if (items.length > 0) {
          setSelectedId(items[0].id);
          setDetailLoading(true);
          const d = await getAssignment(items[0].id);
          if (!cancelled) setDetail(d);
        } else {
          setSelectedId(null);
          setDetail(null);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load assignments';
        setError(msg);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setDetailLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const completedSummary = useMemo(() => {
    if (!detail) return { completed: 0, total: 0, pct: 0 };
    const total = detail.exercises.length;
    const completed = detail.exercises.filter((x) => x.completed).length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { completed, total, pct };
  }, [detail]);

  const onSelect = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const d = await getAssignment(id);
      setDetail(d);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load assignment details';
      setError(msg);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Teacher Assignments</Text>
      <Text style={styles.subtitle}>{user ? `Hi, ${user.name}` : 'Not signed in'}</Text>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Loading assignments…</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && assignments.length === 0 && !error && (
        <View style={styles.center}>
          <Text style={styles.muted}>No assignments yet.</Text>
        </View>
      )}

      {assignments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your assignments</Text>
          {assignments.map((a) => {
            const isSelected = selectedId === a.id;
            const completedText = `${a.completed_exercises}/${a.exercise_count}`;
            return (
              <TouchableOpacity
                key={a.id}
                onPress={() => onSelect(a.id)}
                style={[styles.card, isSelected && styles.cardSelected]}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.cardSub}>
                    Student: {a.student_name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.cardSub}>Progress: {completedText}</Text>
                  {a.avg_score != null ? <Text style={styles.cardSub}>Avg score: {a.avg_score}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {detail && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assignment details</Text>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{detail.title}</Text>
            <Text style={styles.detailSub}>
              Completion: {completedSummary.completed}/{completedSummary.total} ({completedSummary.pct}%)
            </Text>
            {detail.description ? <Text style={styles.detailDesc}>{detail.description}</Text> : null}
          </View>

          {detailLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.muted}>Loading details…</Text>
            </View>
          ) : (
            <View style={styles.exList}>
              {detail.exercises.map((ex, idx) => (
                <View key={`${ex.id}_${idx}`} style={[styles.exCard, ex.completed && styles.exCardCompleted]}>
                  <Text style={styles.exIndex}>{idx + 1}. {String(ex.type)}</Text>
                  <Text style={styles.exLabel}>Prompt:</Text>
                  <Text style={styles.exText}>{ex.content}</Text>
                  <Text style={styles.exLabel}>Expected:</Text>
                  <Text style={styles.exText}>{ex.expected}</Text>

                  <View style={styles.exMetaRow}>
                    <Text style={[styles.badge, ex.completed ? styles.badgeOk : styles.badgeMuted]}>
                      {ex.completed ? 'Completed' : 'Pending'}
                    </Text>
                    <Text style={styles.exMeta}>Attempts: {ex.attempts}</Text>
                  </View>

                  {ex.last_result ? (
                    <Text style={styles.exResult}>
                      Latest: {ex.last_result.student_response ?? '—'} (score {ex.last_result.score})
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  content: { paddingBottom: spacing.xl * 2 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, fontFamily: fonts.bold, marginBottom: 2 },
  subtitle: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 20, marginBottom: spacing.lg },
  muted: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, marginTop: spacing.sm },

  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: fonts.semiBold, marginBottom: spacing.sm },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, fontFamily: fonts.semiBold, marginBottom: 4 },
  cardSub: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 18 },

  detailHeader: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  detailTitle: { fontSize: 16, fontWeight: '700', color: colors.text, fontFamily: fonts.semiBold, marginBottom: 4 },
  detailSub: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 18, marginBottom: spacing.sm },
  detailDesc: { fontSize: 13, color: colors.text, fontFamily: fonts.regular, lineHeight: 19 },

  exList: { gap: spacing.sm },
  exCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  exCardCompleted: {
    borderColor: colors.primary,
  },
  exIndex: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, fontFamily: fonts.semiBold, marginBottom: 6 },
  exLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, fontFamily: fonts.regular, marginTop: 6 },
  exText: { fontSize: 14, color: colors.text, fontFamily: fonts.regular, lineHeight: 20 },

  exMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, fontSize: 12, fontFamily: fonts.semiBold },
  badgeOk: { backgroundColor: 'rgba(46, 204, 113, 0.15)', color: 'rgb(46, 204, 113)' },
  badgeMuted: { backgroundColor: 'rgba(0,0,0,0.04)', color: colors.textSecondary },
  exMeta: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular },
  exResult: { marginTop: spacing.sm, fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 18 },

  errorBox: {
    backgroundColor: 'rgba(244, 67, 54, 0.12)',
    borderColor: 'rgba(244, 67, 54, 0.35)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: 'rgb(244, 67, 54)', fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18 },
});

