import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getStoredStudentId, getOrCreateStudent } from '../../utils/studentStorage';
import { completeGameDay, type GameCompleteDayResponse } from '../../api/game';
import { phaseForDay } from '../../utils/gamePhase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GameCompleteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { user } = useAuth();

  const params = (route.params ?? {}) as RootStackParamList['GameComplete'];
  const scores = params?.scores ?? [];
  const dayNumber = params?.dayNumber ?? 1;

  const avg = useMemo(() => {
    if (!scores.length) return 0;
    const sum = scores.reduce((a, b) => a + b, 0);
    return sum / scores.length;
  }, [scores]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameCompleteDayResponse | null>(null);

  const phaseNumber = phaseForDay(dayNumber);

  const onSave = async () => {
    if (!user) {
      Alert.alert('Log in required', 'Please log in to save your Game Mode completion.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const existing = await getStoredStudentId(user.id);
      const studentId = existing ?? (await getOrCreateStudent(user.id, user.name ?? 'Learner', 10));
      const res = await completeGameDay({
        studentId,
        dayNumber,
        exerciseScores: scores,
      });
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save completion';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MaterialIcons name="emoji-events" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>Day complete</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your score today</Text>
        <Text style={styles.scoreValue}>{Math.round(avg * 100)}%</Text>
        <Text style={styles.scoreSub}>Day {dayNumber} • Phase {phaseNumber}</Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {result ? (
        <View style={styles.card}>
          <Text style={styles.successText}>
            {result.already_completed ? 'Saved (already completed today).' : 'Saved ✓'}
          </Text>
          <Text style={styles.miniText}>
            {result.puzzle_piece_earned ? 'Puzzle piece unlocked! 🎉' : 'Progress saved.'}
          </Text>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('GameHome')}>
            <Text style={styles.secondaryButtonText}>Game home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('GamePuzzle', { phaseId: phaseNumber })}
          >
            <Text style={styles.primaryButtonText}>View puzzle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.primaryButton, (loading || !scores.length) && { opacity: 0.6 }]}
          disabled={loading || !scores.length}
          onPress={onSave}
        >
          {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.primaryButtonText}>Save completion</Text>}
        </TouchableOpacity>
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
  cardTitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: spacing.xs },
  scoreValue: { fontSize: 36, fontWeight: '800', fontFamily: fonts.bold, color: colors.primary },
  scoreSub: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: spacing.sm },
  primaryButton: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
  primaryButtonText: { color: colors.text, fontFamily: fonts.semiBold, fontWeight: '700', fontSize: 16 },
  secondaryButton: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.semiBold, fontWeight: '700', fontSize: 15 },
  errorCard: { backgroundColor: '#ffebee', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontFamily: fonts.regular, fontSize: 13 },
  successText: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.text, marginBottom: spacing.xs },
  miniText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: spacing.sm },
});

