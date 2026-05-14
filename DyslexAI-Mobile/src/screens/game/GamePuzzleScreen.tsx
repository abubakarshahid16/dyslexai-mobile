import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getStoredStudentId, getOrCreateStudent } from '../../utils/studentStorage';
import { getGamePuzzle, type GamePuzzleResponse } from '../../api/game';
import { phaseDayRange } from '../../utils/gamePhase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GamePuzzleScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { user } = useAuth();

  const params = (route.params ?? {}) as RootStackParamList['GamePuzzle'];
  const phaseId = params?.phaseId ?? 1;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<GamePuzzleResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) {
        setLoading(false);
        setError('Please log in to view puzzle pieces.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const existing = await getStoredStudentId(user.id);
        const studentId = existing ?? (await getOrCreateStudent(user.id, user.name ?? 'Learner', 10));
        const res = await getGamePuzzle(phaseId, studentId);
        if (!mounted) return;
        setPuzzle(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not load puzzle';
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
  }, [user?.id, phaseId]);

  const [startDay, endDay] = useMemo(() => {
    if (puzzle?.day_range?.length === 2) return puzzle.day_range;
    return phaseDayRange(phaseId);
  }, [puzzle?.day_range, phaseId]);

  const earnedSet = useMemo(() => new Set(puzzle?.pieces_earned ?? []), [puzzle?.pieces_earned]);
  const earnedCount = puzzle?.pieces_earned?.length ?? 0;
  const totalSlots = puzzle?.pieces_total && puzzle.pieces_total > 0 ? puzzle.pieces_total : (endDay - startDay + 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MaterialIcons name="view-week" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>Phase {phaseId} Puzzle</Text>
      </View>

      {loading ? (
        <View style={styles.card}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.subtitle}>Loading puzzle…</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>Could not load puzzle</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('GameHome')}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Days {startDay}–{endDay}</Text>
            <Text style={styles.bigCounter}>
              {earnedCount} / {totalSlots} pieces revealed
            </Text>
            {totalSlots <= 0 ? (
              <Text style={styles.subtitle}>Puzzle slots are unavailable from backend right now.</Text>
            ) : null}
          </View>

          {totalSlots > 0 ? (
            <View style={styles.grid}>
              {Array.from({ length: totalSlots }, (_, i) => startDay + i).map((day) => {
                const earned = earnedSet.has(day);
                return (
                  <View key={day} style={[styles.tile, earned ? styles.tileEarned : styles.tileLocked]}>
                    <Text style={[styles.tileText, earned ? styles.tileTextEarned : styles.tileTextLocked]}>
                      {earned ? '🧩' : '🔒'}
                    </Text>
                    <Text style={styles.dayLabel}>Day {day}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('GameHome')}>
            <Text style={styles.secondaryButtonText}>Game home</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  headerTitle: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.text, flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  subtitle: { marginTop: spacing.sm, color: colors.textSecondary, fontFamily: fonts.regular },
  errorTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.error, marginBottom: spacing.xs },
  errorText: { color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: spacing.md },
  secondaryButton: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.semiBold, fontWeight: '700', fontSize: 15 },
  cardTitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },
  bigCounter: { fontSize: 22, fontFamily: fonts.bold, color: colors.primary, marginTop: spacing.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  tile: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  tileEarned: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  tileLocked: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
  tileText: { fontFamily: fonts.semiBold, fontSize: 12 },
  tileTextEarned: { color: colors.primary },
  tileTextLocked: { color: colors.textMuted },
  dayLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
});

