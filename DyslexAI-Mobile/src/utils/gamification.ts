/**
 * Gamification: XP, levels, badges. Stored locally (AsyncStorage) per user.
 * XP from: practice sessions (score-based), saving a scan.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@dyslexai';
function key(userId: number | string, suffix: string): string {
  return `${KEY_PREFIX}/${suffix}_${String(userId)}`;
}

const XP_PER_LEVEL = 100; // level 2 at 100, level 3 at 200, etc.
const XP_BASE_PER_PRACTICE = 5;
const XP_SCORE_MULTIPLIER = 15; // e.g. 80% score => 5 + 0.8*15 = 17 XP
const XP_SAVE_SCAN = 10;

export type BadgeId =
  | 'first_session'
  | 'streak_3'
  | 'streak_7'
  | 'score_90'
  | 'score_100'
  | 'scans_5'
  | 'sessions_10'
  | 'level_5';

export const BADGE_INFO: Record<BadgeId, { label: string; icon: string }> = {
  first_session: { label: 'First steps', icon: '🌟' },
  streak_3: { label: '3-day streak', icon: '🔥' },
  streak_7: { label: 'Week warrior', icon: '⭐' },
  score_90: { label: '90%+ score', icon: '🎯' },
  score_100: { label: 'Perfect score', icon: '💯' },
  scans_5: { label: '5 scans saved', icon: '📚' },
  sessions_10: { label: '10 practice sessions', icon: '🏆' },
  level_5: { label: 'Level 5', icon: '⬆️' },
};

async function getStoredNumber(k: string): Promise<number> {
  const raw = await AsyncStorage.getItem(k);
  if (raw == null) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

async function setStored(k: string, value: number | string): Promise<void> {
  await AsyncStorage.setItem(k, String(value));
}

async function getStoredBadges(userId: number | string): Promise<BadgeId[]> {
  const raw = await AsyncStorage.getItem(key(userId, 'badges'));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as string[];
    return arr.filter((id): id is BadgeId => id in BADGE_INFO);
  } catch {
    return [];
  }
}

async function addBadge(userId: number | string, id: BadgeId): Promise<boolean> {
  const badges = await getStoredBadges(userId);
  if (badges.includes(id)) return false;
  badges.push(id);
  await AsyncStorage.setItem(key(userId, 'badges'), JSON.stringify(badges));
  return true;
}

/** Get current total XP for the given user. */
export async function getXP(userId: number | string): Promise<number> {
  return getStoredNumber(key(userId, 'xp'));
}

/** Get current level (1-based) for the given user. */
export async function getLevel(userId: number | string): Promise<number> {
  const xp = await getXP(userId);
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

/** XP needed for next level (from current XP) for the given user. */
export async function getXPToNextLevel(userId: number | string): Promise<{ current: number; needed: number }> {
  const xp = await getXP(userId);
  const currentLevel = Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
  const xpAtCurrentLevel = (currentLevel - 1) * XP_PER_LEVEL;
  return { current: xp - xpAtCurrentLevel, needed: XP_PER_LEVEL };
}

/** Award XP from a practice session (score 0–1). Returns XP earned. */
export async function awardPracticeXP(userId: number | string, score: number): Promise<number> {
  const earned = Math.round(XP_BASE_PER_PRACTICE + score * XP_SCORE_MULTIPLIER);
  const xp = await getXP(userId);
  await setStored(key(userId, 'xp'), xp + earned);

  const practiceKey = key(userId, 'practice_count');
  const sessions = await getStoredNumber(practiceKey);
  await setStored(practiceKey, sessions + 1);

  await updateStreak(userId);
  await checkBadgesAfterPractice(userId, score, sessions + 1);
  return earned;
}

/** Award XP for saving a scan. */
export async function awardScanSavedXP(userId: number | string): Promise<number> {
  const xp = await getXP(userId);
  await setStored(key(userId, 'xp'), xp + XP_SAVE_SCAN);
  const scansKey = key(userId, 'scans_saved_count');
  const scans = await getStoredNumber(scansKey);
  const newCount = scans + 1;
  await setStored(scansKey, newCount);
  if (newCount >= 5) await addBadge(userId, 'scans_5');
  return XP_SAVE_SCAN;
}

async function updateStreak(userId: number | string): Promise<void> {
  const today = new Date().toDateString();
  const lastKey = key(userId, 'last_session_date');
  const streakKey = key(userId, 'streak_days');
  const last = await AsyncStorage.getItem(lastKey);
  let streak = await getStoredNumber(streakKey);

  if (!last) {
    streak = 1;
  } else {
    const lastDate = new Date(last);
    const diffDays = (new Date().getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000);
    if (diffDays > 1) streak = 1;
    else if (diffDays === 1) streak += 1;
  }
  await setStored(lastKey, today);
  await setStored(streakKey, streak);

  if (streak >= 3) await addBadge(userId, 'streak_3');
  if (streak >= 7) await addBadge(userId, 'streak_7');
}

async function checkBadgesAfterPractice(userId: number | string, score: number, totalSessions: number): Promise<void> {
  if (totalSessions === 1) await addBadge(userId, 'first_session');
  if (score >= 0.9) await addBadge(userId, 'score_90');
  if (score >= 1) await addBadge(userId, 'score_100');
  if (totalSessions >= 10) await addBadge(userId, 'sessions_10');
  const level = await getLevel(userId);
  if (level >= 5) await addBadge(userId, 'level_5');
}

/** Get list of unlocked badge IDs for the given user. */
export async function getBadges(userId: number | string): Promise<BadgeId[]> {
  return getStoredBadges(userId);
}

/** Get current streak (days) for the given user. */
export async function getStreak(userId: number | string): Promise<number> {
  return getStoredNumber(key(userId, 'streak_days'));
}

/** Get full gamification state for dashboard for the given user. */
export async function getGamificationState(userId: number | string): Promise<{
  xp: number;
  level: number;
  xpToNext: { current: number; needed: number };
  badges: BadgeId[];
  streak: number;
}> {
  const [xp, level, xpToNext, badges, streak] = await Promise.all([
    getXP(userId),
    getLevel(userId),
    getXPToNextLevel(userId),
    getBadges(userId),
    getStreak(userId),
  ]);
  return { xp, level, xpToNext, badges, streak };
}
