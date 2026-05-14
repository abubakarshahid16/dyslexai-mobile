import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getStoredStudentId, getOrCreateStudent } from '../../utils/studentStorage';
import { getGameToday, type GameTodayResponse } from '../../api/game';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase();
}

function coerceExpectedToString(ans: unknown): string | null {
  if (ans === null || ans === undefined) return null;
  if (typeof ans === 'string' || typeof ans === 'number' || typeof ans === 'boolean') return String(ans);
  return null;
}

function simpleRhyme(a: string, b: string): boolean {
  const clean = (x: string) => String(x ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const sa = clean(a);
  const sb = clean(b);
  if (sa.length < 2 || sb.length < 2) return false;
  return sa.slice(-2) === sb.slice(-2) || (sa.length >= 3 && sb.length >= 3 && sa.slice(-3) === sb.slice(-3));
}

export default function GameSessionScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<GameTodayResponse | null>(null);

  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [subIdx, setSubIdx] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [subScores, setSubScores] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) {
        setLoading(false);
        setError('Please log in to play Game Mode.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const existing = await getStoredStudentId(user.id);
        const studentId = existing ?? (await getOrCreateStudent(user.id, user.name ?? 'Learner', 10));
        const t = await getGameToday(studentId);
        if (!mounted) return;
        setToday(t);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not load today’s mission';
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

  const exercises = today?.exercises ?? [];
  const current = exercises[idx];
  const prompt = useMemo(() => {
    const p = current?.content?.prompt;
    if (typeof p === 'string') return p;
    return 'Tap to answer';
  }, [current]);

  // Reset per-exercise interactive state when changing exercises.
  useEffect(() => {
    setSubIdx(0);
    setTapCount(0);
    setSubScores([]);
    setTyped('');
  }, [idx]);

  const pushScoreAndAdvance = (score01: number) => {
    const nextScores = [...scores, score01];
    if (idx >= exercises.length - 1) {
      navigation.navigate('GameComplete', { scores: nextScores, dayNumber: today?.day?.day_number ?? 1 });
    } else {
      setScores(nextScores);
      setIdx((i) => i + 1);
    }
  };

  const renderSyllableTap = () => {
    const content = current?.content ?? {};
    const words: string[] = Array.isArray(content.words) ? content.words : [];
    const answer: Record<string, number> = typeof content.answer === 'object' && content.answer ? content.answer : {};
    const word = words[subIdx] ?? '';
    const expected = answer[word];

    return (
      <>
        <Text style={styles.subStepLabel}>
          {subIdx + 1}/{words.length} • Word
        </Text>
        <Text style={styles.bigWord}>{word}</Text>
        <Text style={styles.tapHint}>Tap once for each syllable.</Text>

        <TouchableOpacity
          style={[styles.tapButton, submitting && { opacity: 0.7 }]}
          onPress={() => setTapCount((c) => c + 1)}
          disabled={submitting || !word}
          activeOpacity={0.9}
        >
          <Text style={styles.tapButtonText}>Tap</Text>
        </TouchableOpacity>

        <Text style={styles.counterText}>Your taps: {tapCount}</Text>

        <TouchableOpacity
          style={[styles.primaryButton, (!word || expected == null) && { opacity: 0.6 }]}
          onPress={() => {
            if (!word || expected == null) return;
            setSubmitting(true);

            const score = tapCount === expected ? 1 : 0;
            const nextSubScores = [...subScores, score];
            const nextSubIdx = subIdx + 1;

            if (nextSubIdx >= words.length) {
              const avg = nextSubScores.reduce((a, b) => a + b, 0) / Math.max(1, nextSubScores.length);
              pushScoreAndAdvance(avg);
            } else {
              setSubScores(nextSubScores);
              setTapCount(0);
              setSubIdx(nextSubIdx);
            }

            setSubmitting(false);
          }}
          disabled={!word || expected == null}
        >
          <Text style={styles.primaryButtonText}>{subIdx + 1 >= words.length ? 'Finish' : 'Next'}</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderRhymeMatch = () => {
    const content = current?.content ?? {};
    const pairs: Array<[string, string]> = Array.isArray(content.pairs) ? content.pairs : [];
    const answer: unknown = content.answer;
    const rhymeAnswers: boolean[] = Array.isArray(answer) ? (answer as boolean[]) : [];

    const pair = pairs[subIdx] ?? ['', ''];
    const a = pair[0];
    const b = pair[1];

    const expected = typeof rhymeAnswers[subIdx] === 'boolean' ? rhymeAnswers[subIdx] : simpleRhyme(a, b);

    const scoreAndNext = (choiceIsRhyme: boolean) => {
      const score = choiceIsRhyme === expected ? 1 : 0;
      const nextSubScores = [...subScores, score];
      const nextSubIdx = subIdx + 1;
      if (nextSubIdx >= pairs.length) {
        const avg = nextSubScores.reduce((a, b) => a + b, 0) / Math.max(1, nextSubScores.length);
        pushScoreAndAdvance(avg);
      } else {
        setSubScores(nextSubScores);
        setSubIdx(nextSubIdx);
      }
    };

    return (
      <>
        <Text style={styles.subStepLabel}>
          {subIdx + 1}/{pairs.length} • Pair
        </Text>
        <View style={styles.pairBox}>
          <Text style={styles.bigWord}>{a}</Text>
          <Text style={styles.bigWord}>{b}</Text>
        </View>
        <Text style={styles.tapHint}>Tap the answer.</Text>

        <View style={styles.choiceRow}>
          <TouchableOpacity style={styles.choiceBtn} onPress={() => scoreAndNext(true)} activeOpacity={0.85}>
            <Text style={styles.choiceBtnText}>They rhyme</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.choiceBtn} onPress={() => scoreAndNext(false)} activeOpacity={0.85}>
            <Text style={styles.choiceBtnText}>They do not rhyme</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderSingleChoice = () => {
    const content = current?.content ?? {};
    const options: string[] = Array.isArray(content.options) ? content.options : [];
    const expected = coerceExpectedToString(content.answer);

    if (!options.length) {
      return (
        <>
          <Text style={styles.muted}>This game step has no options yet.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => pushScoreAndAdvance(0.5)}>
            <Text style={styles.secondaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <View style={{ marginBottom: spacing.sm }}>
          <Text style={styles.promptSmall}>
            {typeof content.word === 'string' ? `Word: ${content.word}` : null}
            {typeof content.phonemes !== 'undefined' ? `\nSounds: ${Array.isArray(content.phonemes) ? content.phonemes.join(' ') : String(content.phonemes)}` : null}
          </Text>
        </View>
        <View style={styles.choiceGrid}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.choiceBtn}
              onPress={() => {
                const score = expected != null && normalizeForCompare(String(opt)) === normalizeForCompare(expected) ? 1 : 0;
                pushScoreAndAdvance(score);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.choiceBtnText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  };

  const exerciseType = String(current?.exercise_type ?? '');

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.subtitle}>Loading today’s session…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Could not load Game Mode</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('Dashboard')}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MaterialIcons name="sports-esports" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>{today?.day?.title ?? 'Game Session'}</Text>
      </View>

      {current ? (
        <View style={styles.card}>
          <Text style={styles.challengeLabel}>
            Challenge {idx + 1} of {exercises.length}
          </Text>
          <Text style={styles.exerciseType}>
            {exerciseType.replace(/_/g, ' ')}
          </Text>

          <Text style={styles.promptText}>{prompt}</Text>

          {exerciseType === 'syllable_tap' ? renderSyllableTap() : null}
          {exerciseType === 'rhyme_match' ? renderRhymeMatch() : null}
          {exerciseType === 'sound_identify' || exerciseType === 'sound_blend' ? renderSingleChoice() : null}

          {/* Fallback for any other curriculum types */}
          {exerciseType !== 'syllable_tap' &&
          exerciseType !== 'rhyme_match' &&
          exerciseType !== 'sound_identify' &&
          exerciseType !== 'sound_blend' ? (
            <>
              <Text style={styles.muted}>Unsupported step UI. Use typing fallback.</Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                style={styles.input}
                placeholder="Type your answer"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
              />
              <TouchableOpacity
                style={[styles.primaryButton, (!typed.trim() || submitting) && { opacity: 0.6 }]}
                onPress={() => {
                  const expected = coerceExpectedToString(current.content?.answer);
                  const t = normalizeForCompare(typed);
                  const e = expected != null ? normalizeForCompare(expected) : null;
                  const score = e != null && t.length > 0 && t === e ? 1 : 0.5;
                  pushScoreAndAdvance(score);
                }}
                disabled={!typed.trim() || submitting}
              >
                <Text style={styles.primaryButtonText}>Submit</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.subtitleText}>No exercises found for today.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('GameHome')}>
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  subtitle: { marginTop: spacing.sm, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13 },
  errorTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.error, marginBottom: spacing.xs, paddingHorizontal: spacing.md },
  errorText: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  headerTitle: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.text, flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md },
  challengeLabel: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: spacing.xs },
  exerciseType: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.primary, marginBottom: spacing.md },
  promptText: { fontSize: 16, fontFamily: fonts.regular, color: colors.text, lineHeight: 22, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    color: colors.text,
    marginBottom: spacing.md,
  },
  primaryButton: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
  primaryButtonText: { color: colors.text, fontFamily: fonts.semiBold, fontWeight: '700', fontSize: 16 },
  secondaryButton: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.semiBold, fontWeight: '700', fontSize: 15 },
  subtitleText: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: spacing.md },

  muted: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: spacing.sm, lineHeight: 18 },

  bigWord: { fontSize: 34, fontFamily: fonts.bold, color: colors.text, marginVertical: spacing.sm, textAlign: 'center' },
  tapHint: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: spacing.sm, lineHeight: 18, textAlign: 'center' },
  subStepLabel: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: spacing.xs, textAlign: 'center' },

  tapButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  tapButtonText: { color: colors.text, fontFamily: fonts.semiBold, fontWeight: '700', fontSize: 18 },
  counterText: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.semiBold, textAlign: 'center', marginTop: spacing.xs },

  pairBox: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  choiceRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },

  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceBtn: {
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  choiceBtnText: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  promptSmall: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 18 },
});

