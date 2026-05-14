import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { getStoredStudentId, getOrCreateStudent, clearStoredStudent } from '../../utils/studentStorage';
import {
  getNextExercise,
  startSession,
  submitAnswer,
  submitHandwriting,
  submitTracing,
  generateExercises,
  type ExerciseResponse,
  type SubmitResponse,
} from '../../api/exercises';
import { EXERCISE_API_BASE_URL } from '../../constants/config';
import { awardPracticeXP } from '../../utils/gamification';
import { TracingCanvas, type TracingCanvasRef, type TracingScore } from '../../components/TracingCanvas';
import { getAssignment, type AssignmentDetail } from '../../api/assignments';

type Phase = 'loading' | 'exercise' | 'submitting' | 'result';

export default function PracticeScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Practice'>>();
  const exerciseType = route.params?.exerciseType;
  const assignmentId = route.params?.assignmentId;
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [exercise, setExercise] = useState<ExerciseResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [handwritingImageUri, setHandwritingImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [xpEarned, setXpEarned] = useState<number>(0);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [loadingHint, setLoadingHint] = useState(false);
  const [hasTraceStrokes, setHasTraceStrokes] = useState(false);
  const [tracingLetterIndex, setTracingLetterIndex] = useState(0);
  const [tracingLetterScores, setTracingLetterScores] = useState<TracingScore[]>([]);
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [assignmentIndex, setAssignmentIndex] = useState(0);
  const startTimeRef = useRef<number>(0);
  const loadingHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriedAfter404Ref = useRef(false);
  const tracingCanvasRef = useRef<TracingCanvasRef>(null);

  const mapAssignmentExercise = (detail: AssignmentDetail, index: number): ExerciseResponse | null => {
    const item = detail.exercises[index];
    if (!item) return null;
    return {
      id: item.id,
      type: item.type,
      content: item.content,
      expected: item.expected,
      target_words: item.target_words ?? [],
      difficulty: item.difficulty ?? 1,
      age_group: 'all',
      source: 'assignment',
    };
  };

  const loadAssignmentExercise = async (overrideIndex?: number) => {
    if (!assignmentId) return;
    setPhase('loading');
    setError(null);
    try {
      const sid = (await getStoredStudentId(userId)) ?? (await getOrCreateStudent(userId, user?.name ?? 'Learner', 10));
      setStudentId(sid);
      const detail = await getAssignment(assignmentId);
      setAssignment(detail);
      const pendingIndex = detail.exercises.findIndex((item) => !item.completed);
      const idx = typeof overrideIndex === 'number' ? overrideIndex : pendingIndex >= 0 ? pendingIndex : 0;
      const ex = mapAssignmentExercise(detail, idx);
      if (!ex) {
        setError('This assignment has no exercises to practice yet.');
        setPhase('exercise');
        return;
      }
      setAssignmentIndex(idx);
      setExercise(ex);
      startTimeRef.current = Date.now();
      setPhase('exercise');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load assignment exercise');
      setPhase('exercise');
    }
  };

  const loadNext = async (overrideStudentId?: string, avoidExerciseId?: string) => {
    setError(null);
    setResult(null);
    const previousExerciseId = exercise?.id ?? avoidExerciseId;
    setExercise(null);
    setAnswer('');
    setHandwritingImageUri(null);
    setHasTraceStrokes(false);
    setTracingLetterIndex(0);
    setTracingLetterScores([]);
    setPhase('loading');
    setLoadingHint(false);
    if (loadingHintTimer.current) {
      clearTimeout(loadingHintTimer.current);
      loadingHintTimer.current = null;
    }
    if (safetyTimeout.current) {
      clearTimeout(safetyTimeout.current);
      safetyTimeout.current = null;
    }
    loadingHintTimer.current = setTimeout(() => setLoadingHint(true), 8000);
    safetyTimeout.current = setTimeout(() => {
      safetyTimeout.current = null;
      setLoadingHint(true);
      setError(
        `Connection timed out. App is trying: ${EXERCISE_API_BASE_URL}\n\nStart backend: cd dyslexia-backend → .\\venv\\Scripts\\Activate.ps1 → uvicorn app.main:app --host 0.0.0.0 --port 8001`
      );
      setPhase('exercise');
    }, 95000);
    try {
      let sid: string | null = overrideStudentId ?? null;
      if (typeof sid !== 'string' || !sid) {
        sid = (await getStoredStudentId(userId)) ?? (await getOrCreateStudent(userId, user?.name ?? 'Learner', 10));
      }
      setStudentId(sid);
      const ex = await getNextExercise(sid, exerciseType, previousExerciseId);
      if (safetyTimeout.current) {
        clearTimeout(safetyTimeout.current);
        safetyTimeout.current = null;
      }
      if (loadingHintTimer.current) {
        clearTimeout(loadingHintTimer.current);
        loadingHintTimer.current = null;
      }
      setLoadingHint(false);
      retriedAfter404Ref.current = false;
      setExercise(ex);
      startTimeRef.current = Date.now();
      setPhase('exercise');
    } catch (e) {
      if (safetyTimeout.current) {
        clearTimeout(safetyTimeout.current);
        safetyTimeout.current = null;
      }
      if (loadingHintTimer.current) {
        clearTimeout(loadingHintTimer.current);
        loadingHintTimer.current = null;
      }
      setLoadingHint(false);
      const msg = e instanceof Error ? e.message : 'Could not load exercise. Is the exercise backend running on port 8001?';
      const isStudentNotFound = /student not found|404/i.test(msg);
      if (isStudentNotFound && !retriedAfter404Ref.current) {
        retriedAfter404Ref.current = true;
        await clearStoredStudent(userId);
        await loadNext();
        return;
      }
      setError(msg);
      setPhase('exercise');
    }
  };

  const noExercisesFound = error != null && /no exercises|404|not found/i.test(error);

  const handleGenerateMore = async () => {
    const sid = studentId ?? (await getOrCreateStudent(userId, user?.name ?? 'Learner', 10));
    if (!sid) return;
    setGeneratingMore(true);
    setError(null);
    try {
      await generateExercises(sid, exerciseType);
      await loadNext(sid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate exercises.');
    } finally {
      setGeneratingMore(false);
    }
  };

  useEffect(() => {
    if (assignmentId) {
      loadAssignmentExercise();
    } else {
      loadNext();
    }
  }, [userId, exerciseType, assignmentId]);

  const isHandwriting = exercise?.type === 'handwriting';
  const isTracing = exercise?.type === 'tracing';
  const isTyping =
    !exercise?.type ||
    exercise.type === 'word_typing' ||
    exercise.type === 'sentence_typing';

  const canSubmitTyping = !!answer.trim();
  const canSubmitHandwriting = !!handwritingImageUri;
  const tracingExpected = (exercise?.expected ?? (exercise?.content ?? '').replace(/^[^:]*:\s*/i, '').trim() ?? '').replace(/[^a-z]/gi, '');
  const tracingLetters = tracingExpected ? tracingExpected.split('') : [];
  const isTracingWord = isTracing && tracingLetters.length > 1;
  const canSubmitTracing =
    hasTraceStrokes &&
    (tracingLetters.length <= 1 || tracingLetterIndex === tracingLetters.length - 1);

  const handleSubmit = async () => {
    if (!exercise || !studentId) return;
    if (isTyping && !answer.trim()) return;
    if (isHandwriting && !handwritingImageUri) return;
    setPhase('submitting');
    try {
      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      const isHandwritingSession = isHandwriting;
      const { session_id } = await startSession(studentId, exercise.id, isHandwritingSession);
      let res: SubmitResponse;
      if (isTyping) {
        res = await submitAnswer(session_id, answer.trim(), durationSeconds);
      } else if (isHandwriting && handwritingImageUri) {
        res = await submitHandwriting(session_id, handwritingImageUri, durationSeconds);
      } else if (isTracing) {
        const currentScore = tracingCanvasRef.current?.getScore() ?? { score: 0.5, stroke_errors: [] };
        let traceScore: number;
        let strokeErrors: Array<{ letter: string; accuracy: number }>;
        if (isTracingWord && tracingLetterScores.length > 0) {
          const allScores = [...tracingLetterScores, currentScore];
          traceScore = allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length;
          strokeErrors = tracingLetters.map((letter, i) => ({
            letter,
            accuracy: allScores[i]?.score ?? 0.5,
          }));
        } else if (isTracingWord && tracingLetters.length > 0) {
          traceScore = currentScore.score;
          strokeErrors = tracingLetters.map((letter, i) => ({
            letter,
            accuracy: i === tracingLetterIndex ? currentScore.score : 0.5,
          }));
        } else {
          traceScore = currentScore.score;
          strokeErrors = currentScore.stroke_errors;
        }
        res = await submitTracing(session_id, traceScore, durationSeconds, strokeErrors);
      } else {
        setError('Unknown exercise type');
        setPhase('exercise');
        return;
      }
      const earned = await awardPracticeXP(userId, res.score);
      setXpEarned(earned);
      setResult(res);
      setPhase('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
      setPhase('result');
    }
  };

  const handleNextExercise = async () => {
    if (assignmentId && assignment) {
      const nextIdx = assignmentIndex + 1;
      if (nextIdx < assignment.exercises.length) {
        await loadAssignmentExercise(nextIdx);
        return;
      }
    }
    await loadNext(undefined, exercise?.id);
  };

  const requestImagePermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const handleTakeHandwritingPhoto = async () => {
    const ok = await requestImagePermission('camera');
    if (!ok) {
      Alert.alert('Permission needed', 'Camera access is required to photograph your handwriting.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setHandwritingImageUri(result.assets[0].uri);
    }
  };

  const handlePickHandwritingImage = async () => {
    const ok = await requestImagePermission('library');
    if (!ok) {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setHandwritingImageUri(result.assets[0].uri);
    }
  };

  if (phase === 'loading' && !exercise) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your next exercise…</Text>
        <Text style={styles.loadingUrlText}>URL: {EXERCISE_API_BASE_URL}</Text>
        {loadingHint && (
          <View style={styles.loadingHintBox}>
            <Text style={styles.loadingHintTitle}>Taking a while?</Text>
            <Text style={styles.loadingHintText}>
              Ensure the exercise backend is running on port 8001 (see RUN_COMMANDS.md). Same Wi‑Fi as this device.
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (error && !exercise && !result) {
    return (
      <ScrollView contentContainerStyle={styles.centeredScroll}>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.loadingUrlText}>URL: {EXERCISE_API_BASE_URL}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadNext()} disabled={generatingMore}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          {noExercisesFound && (
            <TouchableOpacity
              style={[styles.retryButton, styles.generateButton]}
              onPress={handleGenerateMore}
              disabled={generatingMore}
            >
              {generatingMore ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.retryButtonText}>Generate more exercises</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  if (phase === 'result' && result) {
    const scorePct = Math.round(result.score * 100);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Result</Text>
          {xpEarned > 0 && (
            <View style={styles.xpRow}>
              <Text style={styles.xpEarned}>+{xpEarned} XP</Text>
            </View>
          )}
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Score</Text>
            <Text style={[styles.scoreValue, scorePct >= 75 ? styles.scoreGood : scorePct >= 50 ? styles.scoreOk : styles.scoreLow]}>
              {scorePct}%
            </Text>
          </View>
          <Text style={styles.feedbackText}>{result.feedback}</Text>
          {result.ocr_text != null && (
            <View style={styles.ocrSection}>
              <Text style={styles.errorsTitle}>What we read</Text>
              <Text style={styles.ocrText}>{result.ocr_text}</Text>
            </View>
          )}
          {result.stroke_errors && result.stroke_errors.length > 0 && (
            <View style={styles.errorsSection}>
              <Text style={styles.errorsTitle}>By letter</Text>
              {result.stroke_errors.map((s, i) => (
                <Text key={i} style={styles.errorItem}>{s.letter}: {Math.round(s.accuracy * 100)}%</Text>
              ))}
            </View>
          )}
          {result.char_errors && result.char_errors.length > 0 && (
            <View style={styles.errorsSection}>
              <Text style={styles.errorsTitle}>Details</Text>
              {result.char_errors.slice(0, 5).map((err, i) => (
                <Text key={i} style={styles.errorItem}>
                  Position {err.position}: expected "{err.expected_char}", got "{err.actual_char}" ({err.error_type})
                </Text>
              ))}
            </View>
          )}
        </View>
        <View style={styles.resultActions}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNextExercise}>
            <Text style={styles.nextButtonText}>Next exercise</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
          {!assignmentId && (
            <TouchableOpacity
              style={styles.generateMoreButton}
              onPress={handleGenerateMore}
              disabled={generatingMore}
            >
              {generatingMore ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.generateMoreButtonText}>Generate more exercises</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <Text style={styles.errorUrlHint}>{EXERCISE_API_BASE_URL}</Text>
            <TouchableOpacity onPress={() => loadNext()} style={styles.retryButtonTop}>
              <Text style={styles.errorBannerLink}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {exercise && (
          <>
            <View style={styles.promptCard}>
              <Text style={styles.promptLabel}>Exercise{exercise.type ? ` (${exercise.type})` : ''}</Text>
              {assignment ? (
                <Text style={styles.assignmentMeta}>
                  Assignment: {assignment.title} ({assignmentIndex + 1}/{assignment.exercises.length})
                </Text>
              ) : null}
              <Text style={styles.promptContent}>{exercise.content}</Text>
            </View>

            {isTyping && (
              <>
                <Text style={styles.inputLabel}>Your answer</Text>
                <TextInput
                  style={styles.input}
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Type here…"
                  placeholderTextColor={colors.textMuted}
                  editable={phase !== 'submitting'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            {isHandwriting && (
              <>
                <Text style={styles.inputLabel}>Write on paper (or a whiteboard), then upload a photo</Text>
                <Text style={styles.handwritingHint}>Take a photo of what you wrote, or choose one from your gallery.</Text>
                <View style={styles.handwritingActions}>
                  <TouchableOpacity style={styles.photoButton} onPress={handleTakeHandwritingPhoto} disabled={phase === 'submitting'}>
                    <MaterialIcons name="camera-alt" size={24} color="#fff" />
                    <Text style={styles.photoButtonText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoButton} onPress={handlePickHandwritingImage} disabled={phase === 'submitting'}>
                    <MaterialIcons name="photo-library" size={24} color="#fff" />
                    <Text style={styles.photoButtonText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
                {handwritingImageUri && (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: handwritingImageUri }} style={styles.previewImage} resizeMode="contain" />
                  </View>
                )}
              </>
            )}

            {isTracing && (
              <>
                <Text style={styles.inputLabel}>Trace with your finger on the screen</Text>
                {isTracingWord ? (
                  <Text style={styles.traceHint}>
                    Letter {tracingLetterIndex + 1} of {tracingLetters.length}. Trace this letter, then tap Next letter.
                  </Text>
                ) : (
                  <Text style={styles.traceHint}>Draw the letter below—no photo needed. Follow the dashed outline; your stroke appears in blue.</Text>
                )}
                <TracingCanvas
                  key={`${exercise.id}-${tracingLetterIndex}`}
                  ref={tracingCanvasRef}
                  expected={isTracingWord ? tracingLetters[tracingLetterIndex] ?? '' : tracingExpected}
                  onStrokeChange={setHasTraceStrokes}
                />
                {isTracingWord && tracingLetterIndex < tracingLetters.length - 1 ? (
                  <TouchableOpacity
                    style={styles.nextLetterButton}
                    onPress={() => {
                      const score = tracingCanvasRef.current?.getScore();
                      if (score) setTracingLetterScores((prev) => [...prev, score]);
                      tracingCanvasRef.current?.clear();
                      setTracingLetterIndex((i) => i + 1);
                      setHasTraceStrokes(false);
                    }}
                    disabled={phase === 'submitting' || !hasTraceStrokes}
                  >
                    <Text style={styles.nextLetterButtonText}>Next letter</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.clearTraceButton}
                  onPress={() => tracingCanvasRef.current?.clear()}
                  disabled={phase === 'submitting' || !hasTraceStrokes}
                >
                  <Text style={styles.clearTraceButtonText}>Clear and try again</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (phase === 'submitting' || (isTyping && !canSubmitTyping) || (isHandwriting && !canSubmitHandwriting) || (isTracing && !canSubmitTracing)) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={
                phase === 'submitting' ||
                (isTyping && !canSubmitTyping) ||
                (isHandwriting && !canSubmitHandwriting) ||
                (isTracing && !canSubmitTracing)
              }
            >
              {phase === 'submitting' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  centeredScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  loadingText: { marginTop: spacing.md, fontSize: 16, color: colors.textSecondary, fontFamily: fonts.regular },
  loadingUrlText: { marginTop: spacing.xs, fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular },
  loadingHintBox: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, maxWidth: 320 },
  loadingHintTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, fontFamily: fonts.semiBold },
  loadingHintText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xs, fontFamily: fonts.regular },
  errorText: { marginTop: spacing.md, textAlign: 'center', color: colors.error, paddingHorizontal: spacing.lg, fontFamily: fonts.regular },
  retryButton: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md },
  retryButtonText: { color: '#fff', fontWeight: '600', fontFamily: fonts.semiBold },
  errorBanner: { backgroundColor: '#ffebee', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
  errorBannerText: { fontSize: 13, color: colors.error, fontFamily: fonts.regular, marginBottom: spacing.xs },
  errorUrlHint: { fontSize: 11, color: colors.textMuted, fontFamily: fonts.regular, marginBottom: spacing.sm },
  retryButtonTop: { alignSelf: 'flex-start' },
  errorBannerLink: { color: colors.primary, fontWeight: '600', fontFamily: fonts.semiBold },
  promptCard: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: spacing.md },
  promptLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs, fontFamily: fonts.regular },
  assignmentMeta: { fontSize: 12, color: colors.primary, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  promptContent: { fontSize: 18, color: colors.text, lineHeight: 26, fontFamily: fonts.regular },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 48,
    marginBottom: spacing.lg,
    fontFamily: fonts.regular,
  },
  submitButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: fonts.semiBold },
  resultCard: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: spacing.lg },
  resultTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md, fontFamily: fonts.bold },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.sm },
  scoreLabel: { fontSize: 16, color: colors.textSecondary, marginRight: spacing.sm, fontFamily: fonts.regular },
  scoreValue: { fontSize: 28, fontWeight: '700', fontFamily: fonts.bold },
  scoreGood: { color: colors.success },
  scoreOk: { color: colors.warning },
  scoreLow: { color: colors.error },
  feedbackText: { fontSize: 16, color: colors.text, lineHeight: 24, marginBottom: spacing.md, fontFamily: fonts.regular },
  errorsSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  errorsTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  errorItem: { fontSize: 13, color: colors.textMuted, marginBottom: 2, fontFamily: fonts.regular },
  resultActions: { gap: spacing.sm },
  nextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  nextButtonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: fonts.semiBold },
  generateButton: { marginTop: spacing.sm },
  generateMoreButton: { paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.md },
  generateMoreButtonText: { color: colors.primary, fontWeight: '600', fontSize: 14, fontFamily: fonts.semiBold },
  xpRow: { marginBottom: spacing.sm },
  xpEarned: { fontSize: 16, fontWeight: '600', color: colors.primary, fontFamily: fonts.semiBold },
  ocrSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  ocrText: { fontSize: 16, color: colors.text, fontFamily: fonts.regular },
  handwritingActions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  photoButton: { flex: 1, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', gap: spacing.xs },
  photoButtonText: { color: '#fff', fontWeight: '600', fontSize: 14, fontFamily: fonts.semiBold },
  previewWrap: { marginBottom: spacing.md, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: colors.surface, minHeight: 120 },
  previewImage: { width: '100%', height: 180 },
  traceHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs, fontFamily: fonts.regular },
  handwritingHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm, fontFamily: fonts.regular },
  nextLetterButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.sm },
  nextLetterButtonText: { fontSize: 16, color: '#fff', fontWeight: '600', fontFamily: fonts.semiBold },
  clearTraceButton: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  clearTraceButtonText: { fontSize: 14, color: colors.primary, fontFamily: fonts.regular },
});
