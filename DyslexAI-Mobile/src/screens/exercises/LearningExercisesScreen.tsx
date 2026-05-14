import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { getStoredStudentId } from '../../utils/studentStorage';
import { getStudentStats, getStudentSessionHistory, type StudentSessionHistoryItem, type StudentStats } from '../../api/exercises';
import { listAssignments, getAssignment, type AssignmentListItem } from '../../api/assignments';

const LEARNING_MODULES: Array<{ id: 'word_typing' | 'sentence_typing' | 'handwriting' | 'tracing'; title: string; subtitle: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { id: 'word_typing', title: 'Word Typing', subtitle: 'Spell and type individual words', icon: 'sort' },
  { id: 'sentence_typing', title: 'Sentence Builder', subtitle: 'Type full sentences', icon: 'segment' },
  { id: 'handwriting', title: 'Write & Upload', subtitle: 'Write a letter, word, or sentence on paper (or whiteboard), then upload a photo', icon: 'edit' },
  { id: 'tracing', title: 'Letter & Word Tracing', subtitle: 'Draw letters and words on screen with your finger (no photo)', icon: 'gesture' },
];

export default function LearningExercisesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'LearningExercises'>>();
  const { user } = useAuth();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<StudentSessionHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'word_typing' | 'sentence_typing' | 'handwriting' | 'tracing'>('all');
  const [studentAssignments, setStudentAssignments] = useState<AssignmentListItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      const studentId = await getStoredStudentId(user?.id ?? 0);
      if (studentId) {
        const [statsRes, sessionsRes, assignmentsRes] = await Promise.allSettled([
          getStudentStats(studentId),
          getStudentSessionHistory(studentId, { limit: 20 }),
          listAssignments({ studentId }),
        ]);
        setStats(statsRes.status === 'fulfilled' ? statsRes.value : null);
        setHistory(sessionsRes.status === 'fulfilled' ? sessionsRes.value : []);
        setStudentAssignments(assignmentsRes.status === 'fulfilled' ? assignmentsRes.value : []);
        setHistoryError(
          sessionsRes.status === 'rejected'
            ? 'Session history endpoint is not available yet on backend.'
            : null
        );
      } else {
        setStats(null);
        setHistory([]);
        setStudentAssignments([]);
      }
    } catch {
      setStats(null);
      setHistory([]);
      setStudentAssignments([]);
      setHistoryError('Could not load session history from the exercise backend.');
    }
  };

  useEffect(() => {
    loadStats().finally(() => setLoading(false));
  }, []);

  // Refetch stats when user returns to this screen so progress is up to date
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const accuracyByType = stats?.accuracy_by_type ?? {};
  const modules = LEARNING_MODULES.map((mod) => ({
    ...mod,
    progress: Math.round((accuracyByType[mod.id] ?? 0) * 100),
  }));

  const totalSessions = stats?.total_sessions ?? 0;
  const avgScore = stats?.average_score ?? 0;
  const trend = stats?.score_trend ?? [];
  const visibleHistory = useMemo(
    () =>
      historyFilter === 'all'
        ? history
        : history.filter((item) => (item.exercise_type ?? '').toLowerCase() === historyFilter),
    [history, historyFilter]
  );

  const openAssignment = async (assignmentId: number) => {
    try {
      await getAssignment(assignmentId);
      navigation.navigate('Practice', { assignmentId });
    } catch {
      navigation.navigate('Practice');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <Text style={styles.screenTitle}>Learning Exercises - DyslexAI</Text>

      <TouchableOpacity
        style={styles.startPracticeCard}
        onPress={() => navigation.navigate('Practice')}
        activeOpacity={0.8}
      >
        <View style={styles.startPracticeIconWrap}>
          <MaterialIcons name="fitness-center" size={32} color="#fff" />
        </View>
        <View style={styles.startPracticeContent}>
          <Text style={styles.startPracticeTitle}>Start practice</Text>
          <Text style={styles.startPracticeSubtitle}>Adaptive word & typing exercises with instant feedback</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.heading}>Assigned To You</Text>
        <Text style={styles.subheading}>Assignments from your teacher</Text>
        {studentAssignments.length === 0 ? (
          <Text style={styles.muted}>No active assignments right now.</Text>
        ) : (
          studentAssignments.slice(0, 5).map((item) => (
            <TouchableOpacity
              key={`assignment-${item.id}`}
              style={styles.assignmentCard}
              onPress={() => openAssignment(item.id)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.assignmentTitle}>{item.title}</Text>
                <Text style={styles.assignmentMeta}>
                  {item.exercise_count} exercises • {item.completed_exercises}/{item.exercise_count} complete
                </Text>
                {item.due_at ? (
                  <Text style={styles.assignmentDue}>Due: {new Date(item.due_at).toLocaleDateString()}</Text>
                ) : null}
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Your Progress</Text>
        <Text style={styles.subheading}>Keep it up! You're doing great.</Text>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : (
          <>
            <View style={styles.starsRow}>
              <Text style={styles.starsCount}>{totalSessions}</Text>
              <Text style={styles.starsLabel}>Sessions total</Text>
            </View>
            <View style={styles.starsRow}>
              <Text style={styles.starsCount}>{Math.round(avgScore * 100)}%</Text>
              <Text style={styles.starsLabel}>Average score</Text>
            </View>
            <View style={styles.streakRow}>
              <MaterialIcons name="bolt" size={20} color={colors.primary} />
              <Text style={styles.streakText}>Recent sessions: {trend.length > 0 ? trend.map((s) => `${Math.round(s * 100)}%`).join(', ') : '—'}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Learning Modules</Text>
        <Text style={styles.subheading}>Accuracy by exercise type (from your practice)</Text>
        {modules.map((mod) => (
          <TouchableOpacity
            key={mod.id}
            style={styles.moduleCard}
            onPress={() => navigation.navigate('Practice', { exerciseType: mod.id })}
            activeOpacity={0.8}
          >
            <View style={styles.moduleIconWrap}>
              <MaterialIcons name={mod.icon} size={28} color={colors.primary} />
            </View>
            <View style={styles.moduleContent}>
              <Text style={styles.moduleTitle}>{mod.title}</Text>
              <Text style={styles.moduleSubtitle}>{mod.subtitle}</Text>
              <View style={styles.progressBarWrap}>
                <View style={[styles.progressBar, { width: `${Math.min(100, mod.progress)}%` }]} />
              </View>
              <Text style={styles.progressPct}>{mod.progress}%</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Previous Sessions</Text>
        <Text style={styles.subheading}>Exercise-wise history from your last attempts</Text>
        <View style={styles.filterRow}>
          {(['all', 'word_typing', 'sentence_typing', 'handwriting', 'tracing'] as const).map((key) => {
            const active = historyFilter === key;
            const label =
              key === 'all'
                ? 'All'
                : key === 'word_typing'
                  ? 'Word'
                  : key === 'sentence_typing'
                    ? 'Sentence'
                    : key === 'handwriting'
                      ? 'Handwriting'
                      : 'Tracing';
            return (
              <TouchableOpacity
                key={key}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setHistoryFilter(key)}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {historyError ? <Text style={styles.historyError}>{historyError}</Text> : null}
        {visibleHistory.length === 0 ? (
          <Text style={styles.muted}>No previous sessions for this filter yet.</Text>
        ) : (
          visibleHistory.slice(0, 12).map((item, idx) => (
            <View key={`${item.session_id}-${idx}`} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>
                  {(item.exercise_type ?? 'exercise').replace(/_/g, ' ')} • {Math.round(item.score * 100)}%
                </Text>
                <Text style={styles.historySub} numberOfLines={1}>
                  {item.exercise_content ?? 'Practice session'}
                </Text>
              </View>
              <Text style={styles.historyTime}>
                {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'Recent'}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
    fontFamily: fonts.bold,
  },
  section: { marginBottom: spacing.lg },
  heading: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  subheading: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm, fontFamily: fonts.regular },
  muted: { fontSize: 14, color: colors.textMuted, fontFamily: fonts.regular },
  starsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: spacing.sm },
  starsCount: { fontSize: 24, fontWeight: '700', color: colors.primary, fontFamily: fonts.bold },
  starsLabel: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  streakText: { fontSize: 14, color: colors.text, fontFamily: fonts.regular },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  moduleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  moduleContent: { flex: 1 },
  moduleTitle: { fontSize: 16, fontWeight: '600', color: colors.text, fontFamily: fonts.semiBold },
  moduleSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  progressBarWrap: {
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressPct: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontFamily: fonts.regular },
  startPracticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  startPracticeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  startPracticeContent: { flex: 1 },
  startPracticeTitle: { fontSize: 18, fontWeight: '700', color: '#fff', fontFamily: fonts.bold },
  startPracticeSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontFamily: fonts.regular },
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  assignmentTitle: { fontSize: 15, color: colors.text, fontFamily: fonts.semiBold },
  assignmentMeta: { marginTop: 4, fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular },
  assignmentDue: { marginTop: 2, fontSize: 12, color: colors.warning, fontFamily: fonts.regular },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterPillActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  filterPillText: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular },
  filterPillTextActive: { color: colors.primary, fontFamily: fonts.semiBold },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  historyTitle: { fontSize: 13, color: colors.text, fontFamily: fonts.semiBold, textTransform: 'capitalize' },
  historySub: { marginTop: 2, fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular },
  historyTime: { fontSize: 11, color: colors.textMuted, fontFamily: fonts.regular },
  historyError: { fontSize: 12, color: colors.error, marginBottom: spacing.sm, fontFamily: fonts.regular },
});
