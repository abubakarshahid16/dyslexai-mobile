import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { colors, spacing, borderRadius, fonts } from '../../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSavedScans } from '../../utils/libraryStorage';
import { getStoredStudentId, getOrCreateStudent, clearStoredStudent } from '../../utils/studentStorage';
import { getStudentStats, getStudentSessionHistory, type StudentSessionHistoryItem, type StudentStats } from '../../api/exercises';
import { checkBackends, type BackendStatus } from '../../api/health';
import { EXERCISE_API_BASE_URL } from '../../constants/config';
import { getGamificationState, BADGE_INFO, type BadgeId } from '../../utils/gamification';
import { listAssignments } from '../../api/assignments';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RecentItem =
  | { id: string; type: 'scan'; title: string; time: string; sub?: string }
  | { id: string; type: 'practice'; title: string; time: string; xp: string };

const CHART_BAR_MAX_HEIGHT = 80;

function formatTime(ms: number): string {
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60 * 60 * 1000) return 'Just now';
  if (diff < 24 * 60 * 60 * 1000) return 'Today';
  if (diff < 2 * 24 * 60 * 60 * 1000) return 'Yesterday';
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} days ago`;
  return d.toLocaleDateString();
}

function exerciseTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    word_typing: 'Word typing',
    sentence_typing: 'Sentence builder',
    handwriting: 'Handwriting',
    tracing: 'Tracing',
  };
  return labels[type] ?? type;
}

export default function StudentDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [gameState, setGameState] = useState<{
    xp: number;
    level: number;
    xpToNext: { current: number; needed: number };
    badges: BadgeId[];
    streak: number;
  } | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [exerciseBackendError, setExerciseBackendError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<StudentSessionHistoryItem[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState(0);

  const menuItems: Array<{ key: keyof RootStackParamList; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
    { key: 'Settings', label: 'Settings', icon: 'settings' },
    { key: 'About', label: 'About DyslexAI', icon: 'info-outline' },
    { key: 'Help', label: 'Help', icon: 'help-outline' },
    { key: 'PrivacyPolicy', label: 'Privacy Policy', icon: 'privacy-tip' },
    { key: 'TermsOfUse', label: 'Terms of Use', icon: 'description' },
  ];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          hitSlop={12}
          style={{ padding: 8 }}
        >
          <MaterialIcons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const openMenuScreen = (screen: keyof RootStackParamList) => {
    setMenuVisible(false);
    navigation.navigate(screen);
  };

  const loadBackendStatus = async () => {
    const status = await checkBackends();
    setBackendStatus(status);
  };

  const loadRecent = async () => {
    setExerciseBackendError(null);
    const items: RecentItem[] = [];
    const scans = await getSavedScans();
    scans.slice(0, 5).forEach((s) => {
      const title = s.correctedText?.slice(0, 40) || 'Scanned note';
      items.push({
        id: `scan-${s.id}`,
        type: 'scan',
        title: title + (s.correctedText && s.correctedText.length > 40 ? '…' : ''),
        time: formatTime(s.savedAt),
      });
    });
    try {
      let studentId = await getStoredStudentId(user?.id ?? 0);
      if (!studentId) {
        try {
          studentId = await getOrCreateStudent(user?.id ?? 0, user?.name ?? 'Learner', 10);
        } catch (e) {
          setExerciseBackendError(e instanceof Error ? e.message : 'Cannot reach exercise server');
          setStats(null);
          setRecentItems(items);
          return;
        }
      }
      const [statsRes, historyRes, assignmentsRes] = await Promise.allSettled([
        getStudentStats(studentId),
        getStudentSessionHistory(studentId, { limit: 30 }),
        listAssignments({ studentId }),
      ]);
      setStats(statsRes.status === 'fulfilled' ? statsRes.value : null);
      setSessionHistory(historyRes.status === 'fulfilled' ? historyRes.value : []);
      const assignments = assignmentsRes.status === 'fulfilled' ? assignmentsRes.value : [];
      setPendingAssignments(assignments.filter((item) => item.completed_exercises < item.exercise_count).length);
      const studentStats = statsRes.status === 'fulfilled' ? statsRes.value : null;
      const trend = studentStats?.score_trend || [];
      trend.slice(-5).reverse().forEach((score, i) => {
        items.push({
          id: `practice-${i}-${trend.length}`,
          type: 'practice',
          title: `Practice session`,
          time: studentStats?.total_sessions ? `Session ${Math.max(1, studentStats.total_sessions - trend.length + i + 1)}` : '',
          xp: `${Math.round(score * 100)}%`,
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load progress';
      setExerciseBackendError(msg);
      setStats(null);
      setSessionHistory([]);
      setPendingAssignments(0);
      if (/student not found|404/i.test(msg)) {
        await clearStoredStudent(user?.id ?? 0);
      }
    }
    setRecentItems(items);
  };

  const loadGameState = async () => {
    const state = await getGamificationState(user?.id ?? 0);
    setGameState(state);
  };

  useEffect(() => {
    loadRecent();
    loadGameState();
    loadBackendStatus();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRecent(), loadGameState(), loadBackendStatus()]);
    setRefreshing(false);
  };

  const tools = [
    {
      id: 'scan',
      icon: 'document-scanner' as const,
      title: 'Scan Text',
      subtitle: 'Turn any photo into easy-to-read text',
      onPress: () => navigation.navigate('Upload'),
    },
    {
      id: 'game',
      icon: 'sports-esports' as const,
      title: 'Game Mode',
      subtitle: 'Finish the day to unlock a puzzle',
      onPress: () => navigation.navigate('GameHome'),
    },
    {
      id: 'exercises',
      icon: 'fitness-center' as const,
      title: 'Daily Exercises',
      subtitle: '5 minutes to sharpen your skills',
      onPress: () => navigation.navigate('LearningExercises'),
    },
    {
      id: 'library',
      icon: 'menu-book' as const,
      title: 'My Library',
      subtitle: 'Access your saved stories and notes',
      onPress: () => navigation.navigate('Library'),
    },
  ];
  const sessionsLast7Days = sessionHistory.filter((item) => {
    if (!item.submitted_at) return false;
    return Date.now() - new Date(item.submitted_at).getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const bestRecentScore = sessionHistory.length
    ? Math.round(Math.max(...sessionHistory.slice(0, 10).map((item) => item.score ?? 0)) * 100)
    : 0;
  const weakArea = stats?.accuracy_by_type
    ? Object.entries(stats.accuracy_by_type).sort((a, b) => a[1] - b[1])[0]?.[0]
    : null;
  const exerciseTypeBuckets = Object.entries(
    sessionHistory.reduce<Record<string, number>>((acc, item) => {
      const key = item.exercise_type ?? 'other';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  );

  return (
    <>
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.menuCard}>
                <Text style={styles.menuTitle}>Menu</Text>
                {menuItems.map((item) => (
                  <Pressable
                    key={item.key}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => openMenuScreen(item.key)}
                  >
                    <MaterialIcons name={item.icon} size={22} color={colors.primary} />
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {user && (
        <View style={styles.userRow}>
          <Text style={styles.userText}>Hi, {user.name}</Text>
          <TouchableOpacity
            onPress={async () => {
              await logout();
              navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
            }}
            hitSlop={12}
          >
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      )}

      {backendStatus && (
        <View style={styles.backendCard}>
          <Text style={styles.backendCardTitle}>Backend status</Text>
          <View style={styles.backendRow}>
            <View style={styles.backendItem}>
              <MaterialIcons
                name={backendStatus.scan ? 'check-circle' : 'error'}
                size={20}
                color={backendStatus.scan ? colors.success : colors.error}
              />
              <Text style={[styles.backendLabel, !backendStatus.scan && styles.backendLabelError]}>
                Scan (8000) {backendStatus.scan ? 'OK' : 'Unreachable'}
              </Text>
            </View>
            <View style={styles.backendItem}>
              <MaterialIcons
                name={backendStatus.exercise ? 'check-circle' : 'error'}
                size={20}
                color={backendStatus.exercise ? colors.success : colors.error}
              />
              <Text style={[styles.backendLabel, !backendStatus.exercise && styles.backendLabelError]}>
                Exercises (8001) {backendStatus.exercise ? 'OK' : 'Unreachable'}
              </Text>
            </View>
            {backendStatus.exercise && (
              <View style={styles.backendItem}>
                <MaterialIcons
                  name={backendStatus.exerciseDb === true ? 'check-circle' : 'warning'}
                  size={20}
                  color={backendStatus.exerciseDb === true ? colors.success : colors.warning}
                />
                <Text style={styles.backendLabel}>
                  DB {backendStatus.exerciseDb === true ? 'OK' : backendStatus.exerciseDb === false ? 'No data' : '…'}
                </Text>
              </View>
            )}
          </View>
          {(!backendStatus.scan || !backendStatus.exercise) && (
            <Text style={styles.backendHint}>
              Check .env (emulator: 10.0.2.2; device: your PC IP), firewall (TCP 8000, 8001), and that both backends are running. See NETWORK_FIX.md.
            </Text>
          )}
          {backendStatus.exercise && backendStatus.exerciseDb === false && (
            <Text style={styles.backendHint}>
              Exercise server is up but database has no exercises. Run: cd dyslexia-backend → python db/seed.py
            </Text>
          )}
        </View>
      )}

      {(exerciseBackendError || (backendStatus && !backendStatus.exercise) || (backendStatus?.exercise && backendStatus?.exerciseDb === false)) && (
        <View style={styles.exerciseUnreachableCard}>
          <MaterialIcons name="cloud-off" size={32} color={colors.error} />
          <Text style={styles.exerciseUnreachableTitle}>
            {backendStatus?.exercise && backendStatus?.exerciseDb === false
              ? 'Exercise database not ready'
              : 'Exercise server not reachable'}
          </Text>
          <Text style={styles.exerciseUnreachableText}>
            {backendStatus?.exercise && backendStatus?.exerciseDb === false
              ? 'Server is running but no exercises are in the database. Seed the DB on your PC:'
              : 'Progress and exercises need the backend on port 8001. The app is trying:'}
          </Text>
          <Text style={styles.exerciseUnreachableUrl}>{EXERCISE_API_BASE_URL}</Text>
          <Text style={styles.exerciseUnreachableSteps}>
            {backendStatus?.exercise && backendStatus?.exerciseDb === false
              ? '1. Start PostgreSQL (Docker: docker start dyslexia-db). 2. cd dyslexia-backend → python db/seed.py. 3. Pull down to retry.'
              : 'In a terminal: cd dyslexia-backend → .\\venv\\Scripts\\Activate.ps1 → uvicorn app.main:app --host 0.0.0.0 --port 8001'}
          </Text>
          {!backendStatus?.exercise && (
            <Text style={styles.exerciseUnreachableSteps}>
              Same Wi‑Fi as this device. Set EXPO_PUBLIC_API_URL (and optionally EXPO_PUBLIC_EXERCISE_API_URL) in DyslexAI-Mobile/.env to your PC IP. Restart Expo after changing .env.
            </Text>
          )}
          {exerciseBackendError ? (
            <Text style={styles.exerciseUnreachableError}>{exerciseBackendError}</Text>
          ) : null}
          <Text style={styles.exerciseUnreachableRetry}>Pull down to retry</Text>
        </View>
      )}

      {gameState && (
        <View style={styles.gameCard}>
          <View style={styles.gameRow}>
            <View style={styles.gameStat}>
              <Text style={styles.gameStatValue}>{gameState.xp}</Text>
              <Text style={styles.gameStatLabel}>XP</Text>
            </View>
            <View style={styles.gameStat}>
              <Text style={styles.gameStatValue}>Level {gameState.level}</Text>
              <Text style={styles.gameStatLabel}>
                {gameState.xpToNext.current}/{gameState.xpToNext.needed} to next
              </Text>
            </View>
            <View style={styles.gameStat}>
              <Text style={styles.gameStatValue}>{gameState.streak}</Text>
              <Text style={styles.gameStatLabel}>Day streak</Text>
            </View>
          </View>
          {gameState.badges.length > 0 && (
            <View style={styles.badgesRow}>
              <Text style={styles.badgesLabel}>Badges</Text>
              <View style={styles.badgesWrap}>
                {gameState.badges.slice(0, 8).map((id) => (
                  <View key={id} style={styles.badge}>
                    <Text style={styles.badgeIcon}>{BADGE_INFO[id].icon}</Text>
                    <Text style={styles.badgeLabel} numberOfLines={1}>{BADGE_INFO[id].label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {pendingAssignments > 0 && (
        <View style={styles.assignmentInboxCard}>
          <MaterialIcons name="assignment" size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.assignmentInboxTitle}>Assignment Inbox</Text>
            <Text style={styles.assignmentInboxSub}>
              You have {pendingAssignments} pending assignment{pendingAssignments > 1 ? 's' : ''}.
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('LearningExercises')}>
            <Text style={styles.assignmentInboxLink}>Open</Text>
          </TouchableOpacity>
        </View>
      )}

      {(!exerciseBackendError && (backendStatus?.exercise || stats !== null)) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your progress</Text>
          {stats && stats.total_sessions > 0 ? (
            <>
          <View style={styles.progressOverviewCard}>
            <View style={styles.progressOverviewRow}>
              <View style={styles.progressOverviewStat}>
                <Text style={styles.progressOverviewValue}>
                  {Math.round(stats.average_score * 100)}%
                </Text>
                <Text style={styles.progressOverviewLabel}>Accuracy</Text>
              </View>
              <View style={[styles.progressOverviewDivider]} />
              <View style={styles.progressOverviewStat}>
                <Text style={styles.progressOverviewValue}>{stats.total_sessions}</Text>
                <Text style={styles.progressOverviewLabel}>Sessions</Text>
              </View>
              <View style={[styles.progressOverviewDivider]} />
              <View style={styles.progressOverviewStat}>
                <Text style={styles.progressOverviewValue}>{stats.total_words_practiced}</Text>
                <Text style={styles.progressOverviewLabel}>Words practiced</Text>
              </View>
            </View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiPill}>
                <Text style={styles.kpiValue}>{sessionsLast7Days}</Text>
                <Text style={styles.kpiLabel}>Last 7 days</Text>
              </View>
              <View style={styles.kpiPill}>
                <Text style={styles.kpiValue}>{bestRecentScore}%</Text>
                <Text style={styles.kpiLabel}>Best recent score</Text>
              </View>
              <View style={styles.kpiPill}>
                <Text style={styles.kpiValue}>{weakArea ? exerciseTypeLabel(weakArea) : '—'}</Text>
                <Text style={styles.kpiLabel}>Needs focus</Text>
              </View>
            </View>
          </View>

          {stats.score_trend && stats.score_trend.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Improvement over time</Text>
              <Text style={styles.chartSubtitle}>Last {stats.score_trend.length} sessions (older → newer)</Text>
              <View style={styles.scoreTrendRow}>
                {stats.score_trend.map((score, i) => {
                  const pct = Math.max(0, Math.min(1, score));
                  const h = pct * CHART_BAR_MAX_HEIGHT;
                  return (
                    <View key={`trend-${i}`} style={styles.scoreTrendBarWrap}>
                      <View style={[styles.scoreTrendBar, { height: Math.max(4, h) }]} />
                      <Text style={styles.scoreTrendLabel}>{i + 1}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.scoreTrendLegend}>
                <Text style={styles.scoreTrendLegendText}>0%</Text>
                <Text style={styles.scoreTrendLegendText}>100%</Text>
              </View>
            </View>
          )}

          {stats.accuracy_by_type && Object.keys(stats.accuracy_by_type).length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Accuracy by exercise type</Text>
              {Object.entries(stats.accuracy_by_type).map(([type, acc]) => (
                <View key={type} style={styles.accuracyRow}>
                  <Text style={styles.accuracyLabel} numberOfLines={1}>
                    {exerciseTypeLabel(type)}
                  </Text>
                  <View style={styles.accuracyBarBg}>
                    <View
                      style={[
                        styles.accuracyBarFill,
                        { width: `${Math.round(acc * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.accuracyPct}>{Math.round(acc * 100)}%</Text>
                </View>
              ))}
            </View>
          )}

          {exerciseTypeBuckets.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Practice mix</Text>
              <Text style={styles.chartSubtitle}>How your recent sessions are distributed by exercise type</Text>
              {exerciseTypeBuckets.map(([type, count]) => {
                const maxCount = Math.max(...exerciseTypeBuckets.map((entry) => entry[1]));
                const widthPct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                return (
                  <View key={`mix-${type}`} style={styles.accuracyRow}>
                    <Text style={styles.accuracyLabel} numberOfLines={1}>
                      {exerciseTypeLabel(type)}
                    </Text>
                    <View style={styles.accuracyBarBg}>
                      <View style={[styles.practiceMixFill, { width: `${widthPct}%` }]} />
                    </View>
                    <Text style={styles.accuracyPct}>{count}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {stats.top_confusion_pairs && stats.top_confusion_pairs.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Common mistakes</Text>
              <Text style={styles.chartSubtitle}>Letters or patterns you mix up most often</Text>
              {stats.top_confusion_pairs.map(({ pattern, count }, i) => (
                <View key={`confusion-${i}`} style={styles.confusionRow}>
                  <View style={styles.confusionPatternWrap}>
                    <Text style={styles.confusionPattern}>{pattern}</Text>
                  </View>
                  <Text style={styles.confusionCount}>{count}×</Text>
                </View>
              ))}
            </View>
          )}

          {(stats.words_mastered?.length > 0 || stats.words_struggling?.length > 0) && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Word progress</Text>
              {stats.words_mastered && stats.words_mastered.length > 0 && (
                <View style={styles.wordsBlock}>
                  <Text style={styles.wordsBlockLabel}>Mastered</Text>
                  <View style={styles.wordsWrap}>
                    {stats.words_mastered.slice(0, 12).map((w) => (
                      <View key={w} style={styles.wordChipMastered}>
                        <Text style={styles.wordChipText}>{w}</Text>
                      </View>
                    ))}
                    {stats.words_mastered.length > 12 && (
                      <Text style={styles.wordChipMore}>+{stats.words_mastered.length - 12}</Text>
                    )}
                  </View>
                </View>
              )}
              {stats.words_struggling && stats.words_struggling.length > 0 && (
                <View style={styles.wordsBlock}>
                  <Text style={styles.wordsBlockLabel}>Keep practicing</Text>
                  <View style={styles.wordsWrap}>
                    {stats.words_struggling.slice(0, 12).map((w) => (
                      <View key={w} style={styles.wordChipStruggling}>
                        <Text style={styles.wordChipText}>{w}</Text>
                      </View>
                    ))}
                    {stats.words_struggling.length > 12 && (
                      <Text style={styles.wordChipMore}>+{stats.words_struggling.length - 12}</Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
            </>
          ) : (
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>
                {stats === null ? 'Loading progress…' : 'No practice sessions yet'}
              </Text>
              <Text style={styles.progressTime}>
                {stats === null
                  ? 'Connecting to exercise server…'
                  : 'Start with Daily Exercises to see accuracy, sessions, and word progress here.'}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        {tools.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={styles.toolCard}
            onPress={tool.onPress}
            activeOpacity={0.8}
          >
            <View style={styles.toolIconWrap}>
              <MaterialIcons name={tool.icon} size={28} color={colors.primary} />
            </View>
            <View style={styles.toolText}>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Progress</Text>
          <Pressable onPress={() => navigation.navigate('Library')} hitSlop={12}>
            <Text style={styles.viewAll}>View All</Text>
          </Pressable>
        </View>
        {recentItems.length === 0 ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>No activity yet</Text>
            <Text style={styles.progressTime}>Scan some text or try Daily Exercises to see progress here.</Text>
          </View>
        ) : (
          recentItems.map((item) => (
            <View key={item.id} style={styles.progressCard}>
              <Text style={styles.progressTitle}>{item.title}</Text>
              <Text style={styles.progressTime}>{item.time}</Text>
              <View style={styles.progressMeta}>
                {item.type === 'practice' && item.xp && (
                  <Text style={styles.xpBadge}>{item.xp}</Text>
                )}
                {item.type === 'scan' && item.sub && (
                  <Text style={styles.progressSub}>{item.sub}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  userText: { fontSize: 16, color: colors.text, fontFamily: fonts.regular },
  logoutText: { fontSize: 14, color: colors.primary, fontFamily: fonts.regular },
  backendCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  backendCardTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  backendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  backendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backendLabel: { fontSize: 13, color: colors.text, fontFamily: fonts.regular },
  backendLabelError: { color: colors.error },
  backendHint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, fontFamily: fonts.regular },
  exerciseUnreachableCard: {
    backgroundColor: '#ffebee',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  exerciseUnreachableTitle: { fontSize: 16, fontWeight: '700', color: colors.error, marginBottom: spacing.xs, fontFamily: fonts.semiBold },
  exerciseUnreachableText: { fontSize: 13, color: colors.text, marginBottom: 4, fontFamily: fonts.regular },
  exerciseUnreachableUrl: { fontSize: 12, color: colors.primary, marginBottom: spacing.sm, fontFamily: fonts.regular },
  exerciseUnreachableSteps: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4, fontFamily: fonts.regular },
  exerciseUnreachableError: { fontSize: 12, color: colors.error, marginTop: spacing.sm, fontFamily: fonts.regular },
  exerciseUnreachableRetry: { fontSize: 12, color: colors.primary, marginTop: spacing.sm, fontFamily: fonts.semiBold },
  gameCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  assignmentInboxCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  assignmentInboxTitle: {
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.semiBold,
  },
  assignmentInboxSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
  assignmentInboxLink: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  gameRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.sm },
  gameStat: { alignItems: 'center' },
  gameStatValue: { fontSize: 18, fontWeight: '700', color: colors.primary, fontFamily: fonts.semiBold },
  gameStatLabel: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular },
  badgesRow: { marginTop: spacing.xs },
  badgesLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: fonts.regular },
  badgesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 100,
  },
  badgeIcon: { fontSize: 14, fontFamily: fonts.regular },
  badgeLabel: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.regular },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, fontFamily: fonts.semiBold },
  viewAll: { fontSize: 14, color: colors.primary, fontFamily: fonts.regular },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  toolIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  toolText: { flex: 1 },
  toolTitle: { fontSize: 16, fontWeight: '600', color: colors.text, fontFamily: fonts.semiBold },
  toolSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontFamily: fonts.regular },
  progressCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  progressTitle: { fontSize: 15, fontWeight: '500', color: colors.text, fontFamily: fonts.medium },
  progressTime: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.regular },
  progressMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  xpBadge: { fontSize: 12, fontWeight: '600', color: colors.primary, fontFamily: fonts.semiBold },
  progressSub: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.regular },

  // Progress overview
  progressOverviewCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  progressOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  progressOverviewStat: { alignItems: 'center', flex: 1 },
  progressOverviewValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  progressOverviewLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: fonts.regular,
  },
  progressOverviewDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.divider,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  kpiPill: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  kpiValue: {
    fontSize: 13,
    color: colors.text,
    fontFamily: fonts.semiBold,
  },
  kpiLabel: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },

  // Charts
  chartCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    fontFamily: fonts.semiBold,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontFamily: fonts.regular,
  },
  scoreTrendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_BAR_MAX_HEIGHT + 20,
    gap: 4,
  },
  scoreTrendBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  scoreTrendBar: {
    width: '100%',
    minWidth: 8,
    maxWidth: 24,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  scoreTrendLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: fonts.regular,
  },
  scoreTrendLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  scoreTrendLegendText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  accuracyLabel: {
    width: 110,
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
  accuracyBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    overflow: 'hidden',
    marginHorizontal: spacing.sm,
  },
  accuracyBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  practiceMixFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 6,
  },
  accuracyPct: {
    width: 36,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    fontFamily: fonts.semiBold,
  },
  confusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  confusionPatternWrap: {
    flex: 1,
  },
  confusionPattern: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: colors.text,
  },
  confusionCount: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  wordsBlock: { marginBottom: spacing.sm },
  wordsBlockLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontFamily: fonts.regular,
  },
  wordsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordChipMastered: {
    backgroundColor: colors.success + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  wordChipStruggling: {
    backgroundColor: colors.warning + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  wordChipText: { fontSize: 13, color: colors.text, fontFamily: fonts.regular },
  wordChipMore: { fontSize: 12, color: colors.textMuted, alignSelf: 'center', fontFamily: fonts.regular },

  // Menu (dropdown)
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: spacing.md,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    minWidth: 240,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontFamily: fonts.semiBold,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  menuItemPressed: { backgroundColor: colors.surfaceElevated },
  menuItemLabel: { flex: 1, fontSize: 15, color: colors.text, fontFamily: fonts.regular },
});
