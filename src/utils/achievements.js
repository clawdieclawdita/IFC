const ACHIEVEMENTS_STORAGE_KEY = 'image-converter.achievements';

export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'first-convert',
    name: 'First Convert',
    criteria: 'Awarded on the first successful conversion.',
    target: 1,
    metric: 'totalConverted',
    icon: '✦',
    theme: 'aurora',
    accent: 'var(--achievement-aurora)',
  },
  {
    id: 'power-user',
    name: 'Power User',
    criteria: 'Convert 10 images total.',
    target: 10,
    metric: 'totalConverted',
    icon: '⬢',
    theme: 'signal',
    accent: 'var(--achievement-signal)',
  },
  {
    id: 'batch-master',
    name: 'Batch Master',
    criteria: 'Convert 5 or more images in one batch.',
    target: 5,
    metric: 'largestBatch',
    icon: '▦',
    theme: 'matrix',
    accent: 'var(--achievement-matrix)',
  },
  {
    id: 'streak-master',
    name: 'Streak Master',
    criteria: 'Maintain a 3-day conversion streak.',
    target: 3,
    metric: 'streakDays',
    icon: '☄',
    theme: 'ember',
    accent: 'var(--achievement-ember)',
  },
  {
    id: 'format-explorer',
    name: 'Format Explorer',
    criteria: 'Convert images in 5 different target formats.',
    target: 5,
    metric: 'formatCount',
    icon: '◈',
    theme: 'prism',
    accent: 'var(--achievement-prism)',
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    criteria: 'Convert 10 or more images in one session.',
    target: 10,
    metric: 'sessionConverted',
    icon: '⚡',
    theme: 'volt',
    accent: 'var(--achievement-volt)',
  },
  {
    id: 'pixel-perfectionist',
    name: 'Pixel Perfectionist',
    criteria: 'Convert 100 images total.',
    target: 100,
    metric: 'totalConverted',
    icon: '◎',
    theme: 'halo',
    accent: 'var(--achievement-halo)',
  },
  {
    id: 'conversion-virtuoso',
    name: 'Conversion Virtuoso',
    criteria: 'Convert 500 images total.',
    target: 500,
    metric: 'totalConverted',
    icon: '✺',
    theme: 'nova',
    accent: 'var(--achievement-nova)',
  },
];

const defaultState = {
  totalConverted: 0,
  largestBatch: 0,
  streakDays: 0,
  lastActiveDay: null,
  formatCounts: {},
  sessionConverted: 0,
  unlocked: {},
  unlockedAt: {},
};

const clampProgress = (value, target) => Math.max(0, Math.min(target, value));

const getDayStamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const createDefaultAchievementsState = () => ({
  ...defaultState,
  formatCounts: {},
  unlocked: {},
  unlockedAt: {},
});

export const loadAchievementsState = () => {
  if (typeof window === 'undefined') return createDefaultAchievementsState();

  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return createDefaultAchievementsState();
    const parsed = JSON.parse(raw);
    return {
      ...createDefaultAchievementsState(),
      ...parsed,
      formatCounts: parsed?.formatCounts && typeof parsed.formatCounts === 'object' ? parsed.formatCounts : {},
      unlocked: parsed?.unlocked && typeof parsed.unlocked === 'object' ? parsed.unlocked : {},
      unlockedAt: parsed?.unlockedAt && typeof parsed.unlockedAt === 'object' ? parsed.unlockedAt : {},
    };
  } catch (error) {
    console.warn('[achievements] failed to load state', error);
    return createDefaultAchievementsState();
  }
};

export const persistAchievementsState = (state) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(state));
};

const updateStreak = (lastActiveDay, currentDay) => {
  if (!lastActiveDay) return 1;
  if (lastActiveDay === currentDay) return null;

  const last = new Date(`${lastActiveDay}T00:00:00`);
  const current = new Date(`${currentDay}T00:00:00`);
  const dayDiff = Math.round((current.getTime() - last.getTime()) / 86400000);

  if (dayDiff === 1) return 'increment';
  if (dayDiff > 1) return 'reset';
  return null;
};

export const registerConversionBatch = ({ previousState, batchSize, targetFormat, date = new Date() }) => {
  const nextState = {
    ...createDefaultAchievementsState(),
    ...previousState,
    formatCounts: { ...(previousState?.formatCounts || {}) },
    unlocked: { ...(previousState?.unlocked || {}) },
    unlockedAt: { ...(previousState?.unlockedAt || {}) },
  };

  const safeBatchSize = Math.max(0, Number(batchSize) || 0);
  if (!safeBatchSize) {
    return { state: nextState, unlockedAchievements: [], achievements: getAchievementsView(nextState) };
  }

  const dayStamp = getDayStamp(date);
  const streakUpdate = updateStreak(nextState.lastActiveDay, dayStamp);

  nextState.totalConverted += safeBatchSize;
  nextState.sessionConverted += safeBatchSize;
  nextState.largestBatch = Math.max(nextState.largestBatch, safeBatchSize);
  nextState.lastActiveDay = dayStamp;

  if (streakUpdate === 1) {
    nextState.streakDays = 1;
  } else if (streakUpdate === 'increment') {
    nextState.streakDays += 1;
  } else if (streakUpdate === 'reset') {
    nextState.streakDays = 1;
  } else if (!nextState.streakDays) {
    nextState.streakDays = 1;
  }

  if (targetFormat) {
    nextState.formatCounts[targetFormat] = (nextState.formatCounts[targetFormat] || 0) + safeBatchSize;
  }

  const unlockedAchievements = [];

  ACHIEVEMENT_DEFINITIONS.forEach((definition) => {
    const progress = getMetricValue(nextState, definition.metric);
    if (progress >= definition.target && !nextState.unlocked[definition.id]) {
      nextState.unlocked[definition.id] = true;
      nextState.unlockedAt[definition.id] = new Date(date).toISOString();
      unlockedAchievements.push(definition);
    }
  });

  return {
    state: nextState,
    unlockedAchievements,
    achievements: getAchievementsView(nextState),
  };
};

export const resetSessionAchievements = (previousState) => ({
  ...createDefaultAchievementsState(),
  ...previousState,
  formatCounts: { ...(previousState?.formatCounts || {}) },
  unlocked: { ...(previousState?.unlocked || {}) },
  unlockedAt: { ...(previousState?.unlockedAt || {}) },
  sessionConverted: 0,
});

export const getMetricValue = (state, metric) => {
  switch (metric) {
    case 'totalConverted':
      return Number(state?.totalConverted) || 0;
    case 'largestBatch':
      return Number(state?.largestBatch) || 0;
    case 'streakDays':
      return Number(state?.streakDays) || 0;
    case 'formatCount':
      return Object.keys(state?.formatCounts || {}).filter((key) => (state.formatCounts[key] || 0) > 0).length;
    case 'sessionConverted':
      return Number(state?.sessionConverted) || 0;
    default:
      return 0;
  }
};

export const getAchievementsView = (state) => ACHIEVEMENT_DEFINITIONS.map((definition) => {
  const progressValue = getMetricValue(state, definition.metric);
  const progress = clampProgress(progressValue, definition.target);
  const unlocked = Boolean(state?.unlocked?.[definition.id]);

  return {
    ...definition,
    unlocked,
    progress,
    progressValue,
    progressLabel: unlocked
      ? 'Unlocked'
      : `${Math.min(progressValue, definition.target)} / ${definition.target}`,
    unlockedAt: state?.unlockedAt?.[definition.id] || null,
  };
});

export const ACHIEVEMENTS_STORAGE = ACHIEVEMENTS_STORAGE_KEY;
