import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getStoredStudentId, getOrCreateStudent } from '../../utils/studentStorage';
import { getGameToday, getGameProgress, type GameTodayResponse, type GameProgressResponse } from '../../api/game';
import { phaseForDay } from '../../utils/gamePhase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GameHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<GameTodayResponse | null>(null);
  const [progress, setProgress] = useState<GameProgressResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) {
        setLoading(false);
        setError('Please log in to start Game Mode.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const existing = await getStoredStudentId(user.id);
        const studentId = existing ?? (await getOrCreateStudent(user.id, user.name ?? 'Learner', 10));
        const [t, p] = await Promise.all([getGameToday(studentId), getGameProgress(studentId)]);
        if (!mounted) return;
        setToday(t);
        setProgress(p);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not load Game Mode';
        if (!mounted) return;
        setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const dayNumber = today?.day?.day_number ?? progress?.progress.current_day;
  const phaseNumber = today?.day?.phase_number ?? (dayNumber ? phaseForDay(dayNumber) : 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MaterialIcons name="sports-esports" size={28} color={colors.primary} />
        <Text style={styles.title}>Game Mode</Text>
      </View>

      {loading ? (
        <View style={styles.card}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.subtitle}>Loading today’s mission…</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>Could not load Game Mode</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('Dashboard')}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Today’s mission</Text>
            <Text style={styles.missionTitle}>{today?.day?.title ?? '—'}</Text>
            <Text style={styles.missionMeta}>
              Day {dayNumber ?? '—'} • Phase {phaseNumber}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{progress?.progress.streak ?? 0}</Text>
                <Text style={styles.statLabel}>Day streak</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{progress?.progress.current_day ?? dayNumber ?? 1}</Text>
                <Text style={styles.statLabel}>Next day</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !today && { opacity: 0.6 }]}
            disabled={!today}
            onPress={() => navigation.navigate('GameSession')}
          >
            <Text style={styles.primaryButtonText}>Let’s play!</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('GamePuzzle', { phaseId: phaseNumber })}>
            <Text style={styles.secondaryButtonText}>View puzzle</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, fontFamily: fonts.bold },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  subtitle: { marginTop: spacing.sm, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13 },
  sectionTitle: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: 6 },
  missionTitle: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.text, marginBottom: 4 },
  missionMeta: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.regular },
  row: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, color: colors.primary, fontFamily: fonts.bold, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular, marginTop: 4 },
  divider: { width: 1, height: 44, backgroundColor: colors.divider },
  primaryButton: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
  primaryButtonText: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 16, fontWeight: '700' },
  secondaryButton: { borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceElevated },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 15, fontWeight: '700' },
  errorTitle: { fontSize: 16, color: colors.error, fontFamily: fonts.semiBold, marginBottom: spacing.xs },
  errorText: { color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: spacing.md },
});

