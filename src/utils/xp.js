const STORAGE_KEY = 'image-converter.xp-state';

const FIXED_LEVELS = [
  { level: 1, minXp: 0, nextLevelXp: 100 },
  { level: 2, minXp: 100, nextLevelXp: 300 },
  { level: 3, minXp: 300, nextLevelXp: 700 },
  { level: 4, minXp: 700, nextLevelXp: 1500 },
  { level: 5, minXp: 1500, nextLevelXp: 3000 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const clampNonNegative = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
};

const normalizeTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const startOfDay = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const getLevelFromXp = (xp) => {
  const safeXp = clampNonNegative(xp);

  for (const band of FIXED_LEVELS) {
    if (safeXp < band.nextLevelXp) {
      return band.level;
    }
  }

  return Math.floor(Math.sqrt(safeXp / 100)) + 1;
};

export const getLevelMeta = (xp) => {
  const safeXp = clampNonNegative(xp);
  const fixedBand = FIXED_LEVELS.find((band) => safeXp >= band.minXp && safeXp < band.nextLevelXp);

  if (fixedBand) {
    return {
      level: fixedBand.level,
      levelMinXp: fixedBand.minXp,
      nextLevelXp: fixedBand.nextLevelXp,
    };
  }

  const level = getLevelFromXp(safeXp);
  const levelMinXp = Math.max(3000, (level - 1) ** 2 * 100);
  const nextLevelXp = level ** 2 * 100;

  return {
    level,
    levelMinXp,
    nextLevelXp,
  };
};

export const getProgressFromXp = (xp) => {
  const { level, levelMinXp, nextLevelXp } = getLevelMeta(xp);
  const span = Math.max(1, nextLevelXp - levelMinXp);
  const xpIntoLevel = Math.max(0, clampNonNegative(xp) - levelMinXp);

  return {
    level,
    levelMinXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel: Math.max(0, nextLevelXp - clampNonNegative(xp)),
    progressPercent: Math.max(0, Math.min(100, (xpIntoLevel / span) * 100)),
  };
};

export const getStreakState = (previousTimestamp, now = new Date()) => {
  const today = startOfDay(now);
  const previousDay = previousTimestamp ? startOfDay(previousTimestamp) : null;

  if (!previousDay) {
    return { streak: 1, isStreakActive: false, daysSinceLastConvert: null };
  }

  const daysSinceLastConvert = Math.floor((today.getTime() - previousDay.getTime()) / DAY_MS);

  if (daysSinceLastConvert <= 0) {
    return { streak: 1, isStreakActive: false, daysSinceLastConvert: 0, alreadyConvertedToday: true };
  }

  if (daysSinceLastConvert === 1) {
    return { streakIncrement: 1, isStreakActive: true, daysSinceLastConvert };
  }

  return { streakReset: true, isStreakActive: false, daysSinceLastConvert };
};

export const calculateXpGain = ({ imageCount = 0, hadFirstConvertBonus = false, streakDays = 0 }) => {
  const safeCount = clampNonNegative(imageCount);
  const baseXp = safeCount * 10;
  const batchBonus = safeCount >= 3 ? safeCount * 5 : 0;
  const preMultiplierXp = baseXp + batchBonus + (hadFirstConvertBonus ? 0 : 25);
  const streakMultiplier = streakDays >= 3 ? 1.5 : 1;
  const totalXp = Math.round(preMultiplierXp * streakMultiplier);

  return {
    imageCount: safeCount,
    baseXp,
    batchBonus,
    firstConvertBonus: hadFirstConvertBonus ? 0 : 25,
    streakMultiplier,
    totalXp,
  };
};

export const getDefaultXpState = () => {
  const xp = 0;
  const levelMeta = getProgressFromXp(xp);

  return {
    xp,
    totalConversions: 0,
    level: levelMeta.level,
    streakDays: 0,
    firstConvertCompleted: false,
    lastConvertedAt: null,
    lastGain: null,
  };
};

export const loadXpState = () => {
  if (typeof window === 'undefined') return getDefaultXpState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultXpState();

    const parsed = JSON.parse(raw);
    const xp = clampNonNegative(parsed?.xp);
    const levelMeta = getProgressFromXp(xp);

    return {
      xp,
      totalConversions: clampNonNegative(parsed?.totalConversions),
      level: levelMeta.level,
      streakDays: clampNonNegative(parsed?.streakDays),
      firstConvertCompleted: Boolean(parsed?.firstConvertCompleted),
      lastConvertedAt: normalizeTimestamp(parsed?.lastConvertedAt),
      lastGain: parsed?.lastGain && typeof parsed.lastGain === 'object' ? parsed.lastGain : null,
    };
  } catch {
    return getDefaultXpState();
  }
};

export const persistXpState = (state) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const awardXp = (currentState, { imageCount = 0, now = new Date().toISOString() }) => {
  const previous = currentState || getDefaultXpState();
  const safeCount = clampNonNegative(imageCount);
  if (!safeCount) {
    return { nextState: previous, gain: null, leveledUp: false };
  }

  const previousStreakDays = clampNonNegative(previous.streakDays);
  const previousLevel = getLevelFromXp(previous.xp);
  const nowIso = normalizeTimestamp(now) || new Date().toISOString();
  const today = startOfDay(nowIso);
  const lastDay = previous.lastConvertedAt ? startOfDay(previous.lastConvertedAt) : null;
  const dayDiff = lastDay ? Math.floor((today.getTime() - lastDay.getTime()) / DAY_MS) : null;

  let nextStreakDays = previousStreakDays;
  if (dayDiff === null) nextStreakDays = 1;
  else if (dayDiff <= 0) nextStreakDays = Math.max(1, previousStreakDays);
  else if (dayDiff === 1) nextStreakDays = previousStreakDays + 1;
  else nextStreakDays = 1;

  const gain = calculateXpGain({
    imageCount: safeCount,
    hadFirstConvertBonus: previous.firstConvertCompleted,
    streakDays: nextStreakDays,
  });

  const nextXp = previous.xp + gain.totalXp;
  const nextLevel = getLevelFromXp(nextXp);
  const nextState = {
    xp: nextXp,
    totalConversions: previous.totalConversions + safeCount,
    level: nextLevel,
    streakDays: nextStreakDays,
    firstConvertCompleted: true,
    lastConvertedAt: nowIso,
    lastGain: {
      ...gain,
      streakDays: nextStreakDays,
      awardedAt: nowIso,
      previousLevel,
      nextLevel,
    },
  };

  return {
    nextState,
    gain: nextState.lastGain,
    leveledUp: nextLevel > previousLevel,
  };
};

export const XP_STORAGE_KEY = STORAGE_KEY;
