import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { createAssignment, listTeacherStudents, type TeacherStudent } from '../../api/assignments';
import { createStudent, type StudentResponse } from '../../api/exercises';
import { lookupUserByEmail } from '../../api/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type CreateAssignmentRoute = RootStackParamList['CreateTeacherAssignment'];

function parseSeedWords(seedWords: string[]): string[] {
  const out: string[] = [];
  for (const raw of seedWords) {
    const cleaned = String(raw ?? '')
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/g)
      .map((w) => w.trim())
      .filter(Boolean);
    for (const w of cleaned) {
      if (w.length < 3 || w.length > 10) continue;
      if (!out.includes(w)) out.push(w);
      if (out.length >= 12) return out;
    }
  }
  return out;
}

function parseCommaSeparatedWords(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .split(/[,\\n\\r\\t ]+/g)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => w.length >= 3 && w.length <= 10)
    .filter((w, idx, arr) => arr.indexOf(w) === idx)
    .slice(0, 12);
}

export default function CreateTeacherAssignmentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<{ key: string; name: string; params?: any }>();
  const { user } = useAuth();

  const seedWordsParam = (route.params as CreateAssignmentRoute | undefined)?.seedWords ?? [];

  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [assignNow, setAssignNow] = useState(true);

  const [newStudentName, setNewStudentName] = useState('Learner');
  const [newStudentAge, setNewStudentAge] = useState('10');
  const [emailToAdd, setEmailToAdd] = useState('');
  const [addingByEmail, setAddingByEmail] = useState(false);

  const [mode, setMode] = useState<'custom' | 'generate'>('generate');
  const [generateType, setGenerateType] = useState<'word_typing' | 'sentence_typing' | 'handwriting' | 'tracing'>('word_typing');
  const [difficulty, setDifficulty] = useState('1');
  const [count, setCount] = useState('3');
  const [seedText, setSeedText] = useState('');

  // Custom mode (MVP: one word_typing exercise)
  const [customContent, setCustomContent] = useState('');
  const [customExpected, setCustomExpected] = useState('');
  const [customDifficulty, setCustomDifficulty] = useState('1');

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const seeds = parseSeedWords(seedWordsParam);
    setSeedText(seeds.join(', '));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setStudentsLoading(true);
      try {
        const list = await listTeacherStudents({ teacherId: user.id });
        if (cancelled) return;
        setStudents(list);
        setSelectedStudentId(list[0]?.id ?? null);
      } catch (e) {
        if (cancelled) return;
        Alert.alert('Failed to load students', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    setLoading(false);
  }, []);

  const seedWords = useMemo(() => parseCommaSeparatedWords(seedText), [seedText]);

  const getOrCreateStudentId = async (): Promise<string> => {
    if (!assignNow) return '';
    if (selectedStudentId) return selectedStudentId;

    const name = newStudentName.trim() || 'Learner';
    const age = Number(newStudentAge);
    const safeAge = Number.isFinite(age) && age > 0 ? age : 10;

    const created: StudentResponse = await createStudent(name, safeAge);
    setSelectedStudentId(created.id);
    return created.id;
  };

  const handleAddByEmail = async () => {
    const email = emailToAdd.trim().toLowerCase();
    if (!email) {
      Alert.alert('Enter email', 'Please enter a student email first.');
      return;
    }

    setAddingByEmail(true);
    try {
      const lookup = await lookupUserByEmail(email);
      if (!lookup.found || !lookup.user) {
        Alert.alert('Not found', 'No user exists with that email.');
        return;
      }

      const created = await createStudent(lookup.user.name || 'Learner', 10);
      const newStudent: TeacherStudent = { id: created.id, name: created.name, age: created.age };
      setStudents((prev) => [newStudent, ...prev.filter((s) => s.id !== newStudent.id)]);
      setSelectedStudentId(created.id);
      setEmailToAdd('');
      Alert.alert('Student added', `${lookup.user.email} was linked as a student.`);
    } catch (e) {
      Alert.alert('Add by email failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAddingByEmail(false);
    }
  };

  const onCreate = async () => {
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in as a teacher.');
      return;
    }
    setCreating(true);
    try {
      const studentId = await getOrCreateStudentId();

      const res = await createAssignment({
        teacherId: user.id,
        studentId: assignNow ? studentId : null,
        title: mode === 'generate' ? 'Generated assignment' : 'Custom assignment',
        description: 'Created from teacher mobile UI.',
        dueAt: null,
        mode,
        customExercises:
          mode === 'custom'
            ? [
                {
                  type: 'word_typing',
                  content: customContent.trim(),
                  expected: customExpected.trim(),
                  target_words: [],
                  difficulty: Number(customDifficulty) || 1,
                },
              ]
            : [],
        generate:
          mode === 'generate'
            ? {
                type: generateType,
                words: seedWords,
                difficulty: Number(difficulty) || 1,
                student_age: 10,
                count: Number(count) || 3,
              }
            : undefined,
      });

      Alert.alert('Assignment created', `Saved assignment #${res.id}.`);
      navigation.navigate('TeacherAssignments');
    } catch (e) {
      Alert.alert('Create failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MaterialIcons name="assignment" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Create Assignment</Text>
          <Text style={styles.sub}>Custom or AI-generated exercises for your students.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1) Student</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, assignNow && styles.modeBtnActive]}
            onPress={() => setAssignNow(true)}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeBtnText, assignNow && styles.modeBtnTextActive]}>Assign now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, !assignNow && styles.modeBtnActive]}
            onPress={() => setAssignNow(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeBtnText, !assignNow && styles.modeBtnTextActive]}>Template (assign later)</Text>
          </TouchableOpacity>
        </View>

        {!assignNow ? (
          <Text style={styles.muted}>
            This will be saved without a student. You can assign it later.
          </Text>
        ) : null}

        {assignNow ? (
          <>
            {studentsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : students.length ? (
              <View style={{ gap: spacing.sm }}>
                {students.map((s) => {
                  const active = selectedStudentId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setSelectedStudentId(s.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {s.name} {s.age ? `(${s.age})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.muted}>No students yet. Add one below.</Text>
            )}

            <View style={{ marginTop: spacing.md }}>
          <Text style={styles.miniLabel}>Add by email (existing account)</Text>
          <View style={styles.row}>
            <TextInput
              value={emailToAdd}
              onChangeText={setEmailToAdd}
              placeholder="student@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TouchableOpacity
              style={[styles.addBtn, addingByEmail && { opacity: 0.65 }]}
              onPress={handleAddByEmail}
              disabled={addingByEmail}
            >
              <Text style={styles.addBtnText}>{addingByEmail ? 'Adding…' : 'Add'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.sm }} />
          <Text style={styles.miniLabel}>Or add a new student</Text>
          <View style={styles.row}>
            <TextInput
              value={newStudentName}
              onChangeText={setNewStudentName}
              placeholder="Student name"
              style={styles.input}
            />
            <TextInput
              value={newStudentAge}
              onChangeText={setNewStudentAge}
              placeholder="Age"
              keyboardType="numeric"
              style={[styles.input, { width: 92 }]}
            />
          </View>
        </View>
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2) Mode</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'generate' && styles.modeBtnActive]}
            onPress={() => setMode('generate')}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeBtnText, mode === 'generate' && styles.modeBtnTextActive]}>AI Generate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'custom' && styles.modeBtnActive]}
            onPress={() => setMode('custom')}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeBtnText, mode === 'custom' && styles.modeBtnTextActive]}>Custom</Text>
          </TouchableOpacity>
        </View>
      </View>

      {mode === 'generate' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3) Generation settings</Text>

          <Text style={styles.miniLabel}>Exercise type</Text>
          <View style={styles.grid2}>
            {(
              [
                ['word_typing', 'Word typing'],
                ['sentence_typing', 'Sentence typing'],
                ['handwriting', 'Handwriting'],
                ['tracing', 'Tracing'],
              ] as Array<[typeof generateType, string]>
            ).map(([value, label]) => {
              const active = generateType === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.pillSmall, active && styles.pillSmallActive]}
                  onPress={() => setGenerateType(value)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.pillSmallText, active && styles.pillSmallTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.row}>
            <TextInput
              value={difficulty}
              onChangeText={setDifficulty}
              placeholder="Difficulty (1-10)"
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              value={count}
              onChangeText={setCount}
              placeholder="Count"
              keyboardType="numeric"
              style={[styles.input, { width: 110 }]}
            />
          </View>

          <Text style={styles.miniLabel}>Seed words (optional)</Text>
          <TextInput
            value={seedText}
            onChangeText={setSeedText}
            placeholder="Comma-separated words (e.g. cat, hat, sun)"
            style={styles.inputMultiline}
            multiline
          />
          <Text style={styles.muted}>
            If empty, the backend will auto-pick weak words for the student.
          </Text>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3) Custom exercise (MVP)</Text>
          <Text style={styles.miniLabel}>Content (prompt word)</Text>
          <TextInput value={customContent} onChangeText={setCustomContent} placeholder="e.g. cake" style={styles.input} autoCapitalize="none" />
          <Text style={styles.miniLabel}>Expected answer</Text>
          <TextInput value={customExpected} onChangeText={setCustomExpected} placeholder="e.g. cake" style={styles.input} autoCapitalize="none" />
          <Text style={styles.miniLabel}>Difficulty</Text>
          <TextInput value={customDifficulty} onChangeText={setCustomDifficulty} placeholder="1" keyboardType="numeric" style={styles.input} />
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, creating && { opacity: 0.65 }]}
        onPress={onCreate}
        disabled={creating}
      >
        <Text style={styles.primaryButtonText}>{creating ? 'Creating…' : 'Create Assignment'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.sm, fontSize: 14, color: colors.textSecondary, fontFamily: fonts.regular },

  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: fonts.semiBold },
  sub: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.regular, lineHeight: 18, marginTop: 2 },

  section: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: fonts.semiBold, marginBottom: spacing.sm },
  miniLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular, marginBottom: spacing.xs },
  muted: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular, lineHeight: 18, marginTop: spacing.xs },

  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },

  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  inputMultiline: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    color: colors.text,
    minHeight: 72,
    textAlignVertical: 'top',
  },

  primaryButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.lg },
  primaryButtonText: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 16, fontWeight: '700' },

  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  pillActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  pillText: { fontFamily: fonts.semiBold, color: colors.text, fontSize: 14 },
  pillTextActive: { color: colors.primary },

  modeRow: { flexDirection: 'row', gap: spacing.md },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  modeBtnText: { fontFamily: fonts.semiBold, color: colors.textSecondary, textAlign: 'center' },
  modeBtnTextActive: { color: colors.primary },

  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  pillSmall: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  pillSmallActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  pillSmallText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13 },
  pillSmallTextActive: { color: colors.primary },

  addBtn: {
    minWidth: 84,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  addBtnText: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 14 },
});

