import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ConvertButton from './components/ConvertButton';
import ConvertedZone from './components/ConvertedZone';
import DailyGoalPanel from './components/DailyGoalPanel';
import FormatSelector from './components/FormatSelector';
import { MenuBar } from './components/MenuBar';
import { OfflineBadge } from './components/OfflineBadge';
import ProgressBar from './components/ProgressBar';
import QueuePanel from './components/QueuePanel';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { SettingsPanel } from './components/SettingsPanel';
import ImageEditor from './components/ImageEditor';
import UploadZone from './components/UploadZone';
import XpProgress from './components/XpProgress';
import { applyAiProcessing, shouldApplyAi } from './utils/aiProcessing';
import { convertSingle, createZip, triggerDownload } from './lib/api';
import {
  ACHIEVEMENT_DEFINITIONS as ACHIEVEMENT_SYSTEM_DEFINITIONS,
  getAchievementsView,
  loadAchievementsState,
  persistAchievementsState,
  registerConversionBatch,
  resetSessionAchievements,
} from './utils/achievements';
import { awardXp, loadXpState, persistXpState } from './utils/xp';

const EXTENSION_ALIASES = {
  jpeg: 'jpg',
  tif: 'tiff',
};

const QUALITY_FORMATS = new Set(['jpg', 'webp']);
const QUALITY_DEFAULT = 85;
const STORAGE_KEYS = {
  activePanel: 'image-converter.activePanel',
  menuCollapsed: 'image-converter.menuCollapsed',
  quality: 'image-converter.quality',
  width: 'image-converter.width',
  height: 'image-converter.height',
  keepAspectRatio: 'image-converter.keepAspectRatio',
  autoClearOnExit: 'image-converter.autoClearOnExit',
  stripMetadata: 'image-converter.stripMetadata',
  preserveMetadata: 'image-converter.preserveMetadata',
  filenameConvention: 'image-converter.filenameConvention',
  customFilenamePattern: 'image-converter.customFilenamePattern',
  preserveFolderStructure: 'image-converter.preserveFolderStructure',
  darkMode: 'image-converter.darkMode',
  reducedMotion: 'image-converter.reducedMotion',
  celebrationSoundEnabled: 'image-converter.celebrationSoundEnabled',
  celebrationStats: 'image-converter.celebrationStats',
  dailyGoal: 'image-converter.dailyGoal',
  dailyGoalState: 'image-converter.dailyGoalState',
  queue: 'image-converter.queue',
  aiState: 'image-converter.aiState',
  aiSkipMap: 'image-converter.aiSkipMap',
  powerUps: 'image-converter.powerUps',
  gamificationTab: 'image-converter.gamificationTab',
  magicMoments: 'image-converter.magicMoments',
};

const XP_PER_CONVERSION = 25;

const DEFAULT_AI_STATE = Object.freeze({
  enabled: true,
  autoEnhance: true,
  backgroundRemoval: false,
  stylePreset: 'none',
  styleIntensity: 0.72,
  batchEnabled: true,
});

const DEFAULT_POWER_UPS = Object.freeze({
  xpMultiplierEndsAt: null,
  streakSaveArmed: true,
  achievementBoost: true,
});

const DEFAULT_MAGIC_MOMENTS = Object.freeze({
  history: [],
});

const loadJsonStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

const getLeaderboardSnapshot = ({ weeklyConversions, totalConversions, streakDays }) => {
  const monthlyScore = totalConversions;

  const weeklyBoard = [
    { name: 'Nova', xp: 1820, streak: 15, conversions: 42 },
    { name: 'Pixel', xp: 1640, streak: 11, conversions: 35 },
    { name: 'You', xp: 420 + (weeklyConversions * 40), streak: Math.max(1, streakDays), conversions: weeklyConversions },
    { name: 'Alex', xp: 1280, streak: 7, conversions: 24 },
    { name: 'Quartz', xp: 1080, streak: 6, conversions: 21 },
    { name: 'Echo', xp: 960, streak: 5, conversions: 18 },
    { name: 'Vector', xp: 840, streak: 4, conversions: 15 },
    { name: 'Luma', xp: 760, streak: 3, conversions: 13 },
    { name: 'Kite', xp: 620, streak: 2, conversions: 11 },
    { name: 'Mica', xp: 540, streak: 2, conversions: 9 },
  ].sort((left, right) => right.xp - left.xp).map((entry, index) => ({ ...entry, rank: index + 1 }));

  const monthlyBoard = [
    { name: 'Nova', xp: 6240, streak: 28, conversions: 155 },
    { name: 'Pixel', xp: 5780, streak: 22, conversions: 141 },
    { name: 'Alex', xp: 5180, streak: 19, conversions: 126 },
    { name: 'You', xp: 900 + (monthlyScore * 38), streak: Math.max(1, streakDays), conversions: monthlyScore },
    { name: 'Quartz', xp: 4320, streak: 17, conversions: 109 },
    { name: 'Echo', xp: 3980, streak: 14, conversions: 101 },
    { name: 'Vector', xp: 3520, streak: 11, conversions: 92 },
    { name: 'Luma', xp: 3140, streak: 9, conversions: 85 },
    { name: 'Kite', xp: 2760, streak: 8, conversions: 73 },
    { name: 'Mica', xp: 2380, streak: 6, conversions: 64 },
  ].sort((left, right) => right.xp - left.xp).map((entry, index) => ({ ...entry, rank: index + 1 }));

  const localWeeklyRow = weeklyBoard.find((entry) => entry.name === 'You') || weeklyBoard[0];
  const localMonthlyRow = monthlyBoard.find((entry) => entry.name === 'You') || monthlyBoard[0];

  return {
    weekly: {
      rankLabel: `#${localWeeklyRow.rank}`,
      scoreLabel: `${weeklyConversions} conversions this week`,
      board: weeklyBoard,
    },
    monthly: {
      rankLabel: monthlyScore >= 100 ? 'Diamond lane' : monthlyScore >= 50 ? 'Gold lane' : 'Rising',
      scoreLabel: `${monthlyScore} total converted`,
      board: monthlyBoard,
    },
    friend: {
      label: streakDays >= 7 ? 'Ahead of Alex' : 'Chasing Alex',
      delta: streakDays >= 7 ? `+${streakDays - 6} streak lead` : `${Math.max(1, 7 - streakDays)} days to catch up`,
    },
    local: {
      weeklyRank: localWeeklyRow.rank,
      monthlyRank: localMonthlyRow.rank,
    },
  };
};

const formatRemainingTime = (milliseconds) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'Ready';
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
};

const getTodayStamp = () => new Date().toISOString().slice(0, 10);

const getDefaultCelebrationStats = () => ({
  totalConversions: 0,
  currentStreak: 1,
  bestStreak: 1,
  lastActiveDate: getTodayStamp(),
  weeklyConversions: 0,
  weeklyWindowStart: getTodayStamp(),
  unlockedAchievements: [],
});

const getDaysBetween = (start, end) => {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.round((endDate - startDate) / 86400000);
};

const normalizeCelebrationStats = (value) => {
  const fallback = getDefaultCelebrationStats();
  if (!value || typeof value !== 'object') return fallback;

  return {
    totalConversions: Number(value.totalConversions) || 0,
    currentStreak: Math.max(1, Number(value.currentStreak) || 1),
    bestStreak: Math.max(1, Number(value.bestStreak) || 1),
    lastActiveDate: typeof value.lastActiveDate === 'string' ? value.lastActiveDate : fallback.lastActiveDate,
    weeklyConversions: Math.max(0, Number(value.weeklyConversions) || 0),
    weeklyWindowStart: typeof value.weeklyWindowStart === 'string' ? value.weeklyWindowStart : fallback.weeklyWindowStart,
    unlockedAchievements: Array.isArray(value.unlockedAchievements) ? value.unlockedAchievements : [],
  };
};

const parseCelebrationStorage = () => {
  if (typeof window === 'undefined') return getDefaultCelebrationStats();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.celebrationStats);
    if (!raw) return getDefaultCelebrationStats();
    return normalizeCelebrationStats(JSON.parse(raw));
  } catch (error) {
    console.warn('[celebration:stats] failed to parse, resetting', error);
    return getDefaultCelebrationStats();
  }
};

const DEFAULT_CROP = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

const FORMAT_SIZE_MULTIPLIERS = {
  jpg: 0.82,
  png: 1.15,
  bmp: 2.35,
  tiff: 1.6,
  webp: 0.68,
  gif: 0.92,
  svg: 0.75,
};

const base64ToBlob = (base64, mimeType) => {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let index = 0; index < byteString.length; index += 1) {
    bytes[index] = byteString.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Failed to read file for persistence.'));
  reader.readAsDataURL(blob);
});

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to load image for thumbnail generation.'));
  image.src = src;
});

const generateThumbnailDataUrl = async (file, { rotation = 0, crop = DEFAULT_CROP } = {}) => {
  if (typeof window === 'undefined' || !file?.type?.startsWith('image/')) {
    return '';
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(sourceUrl);
    const normalizedRotation = normalizeRotation(rotation);
    const normalizedCrop = normalizeCrop(crop);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const rotatedWidth = normalizedRotation % 180 === 0 ? sourceWidth : sourceHeight;
    const rotatedHeight = normalizedRotation % 180 === 0 ? sourceHeight : sourceWidth;
    const cropLeft = Math.round(rotatedWidth * (normalizedCrop.left / 100));
    const cropRight = Math.round(rotatedWidth * (normalizedCrop.right / 100));
    const cropTop = Math.round(rotatedHeight * (normalizedCrop.top / 100));
    const cropBottom = Math.round(rotatedHeight * (normalizedCrop.bottom / 100));
    const outputWidth = Math.max(1, rotatedWidth - cropLeft - cropRight);
    const outputHeight = Math.max(1, rotatedHeight - cropTop - cropBottom);
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to create thumbnail canvas context.');
    }

    context.save();
    context.translate(rotatedWidth / 2 - cropLeft, rotatedHeight / 2 - cropTop);
    context.rotate((normalizedRotation * Math.PI) / 180);
    context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
    context.restore();

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};

const dataUrlToFile = async ({ dataUrl, name, type, lastModified }) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type, lastModified });
};

const getFileExtension = (file) => {
  const extension = file?.name?.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_ALIASES[extension] || extension;
};

const getFileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const SWIPE_DURATION_MS = 1200;
const ARRIVAL_DURATION_MS = 280;
const MAX_VISIBLE_SWIPE_STACK = 4;

const parseNumberStorage = (key) => {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(key);
  if (value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseBooleanStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
};

const parseOptionalBooleanStorage = (key) => {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(key);
  if (value === null || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

const clampDimension = (value, max = 4000) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const cappedMax = Math.max(1, Math.min(4000, Math.round(max || 4000)));
  return Math.max(1, Math.min(cappedMax, Math.round(numeric)));
};

const clampDailyGoal = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.max(1, Math.min(100, Math.round(numeric)));
};

const getLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getDayDiff = (fromDateKey, toDateKey) => {
  if (!fromDateKey || !toDateKey) return Number.POSITIVE_INFINITY;
  const from = new Date(`${fromDateKey}T00:00:00`);
  const to = new Date(`${toDateKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
};

const createDefaultDailyGoalState = () => ({
  count: 0,
  streak: 0,
  lastActiveDate: getLocalDateKey(),
  lastCompletedDate: null,
  completedToday: false,
  lastResetAt: new Date().toISOString(),
});

const normalizeDailyGoalState = (value) => {
  const fallback = createDefaultDailyGoalState();
  if (!value || typeof value !== 'object') return fallback;

  return {
    count: Math.max(0, Number(value.count) || 0),
    streak: Math.max(0, Number(value.streak) || 0),
    lastActiveDate: typeof value.lastActiveDate === 'string' ? value.lastActiveDate : fallback.lastActiveDate,
    lastCompletedDate: typeof value.lastCompletedDate === 'string' ? value.lastCompletedDate : null,
    completedToday: Boolean(value.completedToday),
    lastResetAt: typeof value.lastResetAt === 'string' ? value.lastResetAt : fallback.lastResetAt,
  };
};

const readImageDimensions = (file) => new Promise((resolve) => {
  if (!file?.type?.startsWith('image/')) {
    resolve({ originalWidth: 0, originalHeight: 0 });
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve({ originalWidth: image.naturalWidth || 0, originalHeight: image.naturalHeight || 0 });
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    resolve({ originalWidth: 0, originalHeight: 0 });
  };

  image.src = objectUrl;
});

const getMinOriginalDimensions = (files) => {
  const imageFiles = files.filter((file) => Number(file.originalWidth) > 0 && Number(file.originalHeight) > 0);
  if (!imageFiles.length) return { originalSize: 0, originalWidth: 0, originalHeight: 0 };

  return imageFiles.reduce((min, file) => ({
    originalSize: Math.min(min.originalSize, file.size || min.originalSize || 0),
    originalWidth: Math.min(min.originalWidth, file.originalWidth),
    originalHeight: Math.min(min.originalHeight, file.originalHeight),
  }), {
    originalSize: imageFiles[0].size || 0,
    originalWidth: imageFiles[0].originalWidth,
    originalHeight: imageFiles[0].originalHeight,
  });
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const estimateOutputSize = ({
  originalSize = 0,
  originalWidth,
  originalHeight,
  width,
  height,
  quality,
  targetFormat,
}) => {
  if (!originalSize) return 0;

  const safeOriginalWidth = Number(originalWidth) || 1;
  const safeOriginalHeight = Number(originalHeight) || 1;
  const safeWidth = Number(width) || safeOriginalWidth;
  const safeHeight = Number(height) || safeOriginalHeight;
  const areaRatio = Math.max(0.05, (safeWidth * safeHeight) / (safeOriginalWidth * safeOriginalHeight));
  const formatMultiplier = FORMAT_SIZE_MULTIPLIERS[targetFormat] ?? 1;
  const qualityRatio = QUALITY_FORMATS.has(targetFormat)
    ? Math.max(0.12, Number(quality ?? QUALITY_DEFAULT) / 100)
    : 1;

  return Math.max(1024, Math.round(originalSize * areaRatio * formatMultiplier * qualityRatio));
};

const serializeQueueFile = async (file) => ({
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified,
  originalWidth: file.originalWidth || 0,
  originalHeight: file.originalHeight || 0,
  relativePath: file.relativePath || file.webkitRelativePath || '',
  rotation: Number(file.rotation) || 0,
  crop: {
    top: Number(file.crop?.top) || 0,
    right: Number(file.crop?.right) || 0,
    bottom: Number(file.crop?.bottom) || 0,
    left: Number(file.crop?.left) || 0,
  },
  thumbnailDataUrl: file.thumbnailDataUrl || '',
  dataUrl: await blobToDataUrl(file),
});

const persistQueueState = async ({ files, convertedFiles, paused, processing }) => {
  if (typeof window === 'undefined') return;

  const serializedQueue = await Promise.all(files.map(serializeQueueFile));
  const payload = {
    queue: serializedQueue,
    converted: convertedFiles,
    paused,
    processing,
  };

  window.localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(payload));
  console.log('[queue:persist] saved', {
    queueLength: serializedQueue.length,
    convertedLength: convertedFiles.length,
    paused,
    processingLength: processing.length,
    names: serializedQueue.map((file) => file.name),
  });
};

const clearPrivacyStorage = async () => {
  if (typeof window === 'undefined') return;

  const keysToRemove = [
    STORAGE_KEYS.queue,
    STORAGE_KEYS.activePanel,
  ];
  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  window.sessionStorage.clear();

  try {
    await fetch('/api/temp/clear', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      keepalive: true,
    });
  } catch (error) {
    console.warn('[privacy:auto-clear] temp cleanup request failed', error);
  }
};

const deserializeQueueFile = async (record) => {
  const file = await dataUrlToFile(record);
  return Object.assign(file, {
    originalWidth: record.originalWidth || 0,
    originalHeight: record.originalHeight || 0,
    relativePath: record.relativePath || '',
    rotation: Number(record.rotation) || 0,
    crop: {
      top: Number(record.crop?.top) || 0,
      right: Number(record.crop?.right) || 0,
      bottom: Number(record.crop?.bottom) || 0,
      left: Number(record.crop?.left) || 0,
    },
    thumbnailDataUrl: record.thumbnailDataUrl || '',
  });
};

const normalizeRotation = (value) => {
  const numeric = Number(value) || 0;
  const normalized = ((numeric % 360) + 360) % 360;
  return normalized;
};

const clampCropPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(90, Math.round(numeric)));
};

const normalizeCrop = (crop = DEFAULT_CROP) => {
  const next = {
    top: clampCropPercent(crop.top),
    right: clampCropPercent(crop.right),
    bottom: clampCropPercent(crop.bottom),
    left: clampCropPercent(crop.left),
  };

  if (next.left + next.right > 90) {
    const overflow = next.left + next.right - 90;
    if (next.right >= overflow) next.right -= overflow;
    else next.left = Math.max(0, next.left - (overflow - next.right));
  }

  if (next.top + next.bottom > 90) {
    const overflow = next.top + next.bottom - 90;
    if (next.bottom >= overflow) next.bottom -= overflow;
    else next.top = Math.max(0, next.top - (overflow - next.bottom));
  }

  return next;
};

function SwipePreview({ file }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!file?.type?.startsWith('image/')) return undefined;

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!file?.type?.startsWith('image/')) {
    return <span>{file?.name?.slice(0, 2).toUpperCase() || 'IMG'}</span>;
  }

  return <img src={src} alt={file.name} />;
}

gsap.registerPlugin(useGSAP, ScrollTrigger);

function DarkModeToggle({ darkMode, resolvedDarkMode, onChange }) {
  const currentMode = darkMode === null ? 'auto' : darkMode ? 'dark' : 'light';
  const nextMode = currentMode === 'light' ? 'auto' : currentMode === 'auto' ? 'dark' : 'light';
  const icon = currentMode === 'dark' ? '🌙' : currentMode === 'auto' ? '🌗' : '☀️';
  const label = currentMode === 'dark'
    ? 'Dark mode enabled. Click to switch to auto theme.'
    : currentMode === 'auto'
      ? `Auto theme enabled (${resolvedDarkMode ? 'system dark' : 'system light'}). Click to switch to dark mode.`
      : 'Light mode enabled. Click to switch to auto theme.';

  const handleClick = () => {
    if (nextMode === 'auto') {
      onChange('darkMode', 'auto');
      return;
    }

    onChange('darkMode', nextMode === 'dark');
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      aria-pressed={currentMode === 'dark'}
      data-theme-mode={currentMode}
      onClick={handleClick}
      title={label}
    >
      <span className="theme-toggle__icon" aria-hidden="true">{icon}</span>
      <span className="theme-toggle__label">Theme</span>
    </button>
  );
}

function CelebrationToast({ toast, onDismiss }) {
  return (
    <article
      className={`celebration-toast celebration-toast--${toast.variant || 'achievement'}`}
      role="status"
      aria-live="polite"
      onClick={() => onDismiss(toast.id)}
    >
      <div className="celebration-toast__badge" aria-hidden="true">{toast.icon || '✨'}</div>
      <div className="celebration-toast__copy">
        <strong>{toast.title}</strong>
        <p>{toast.description}</p>
      </div>
      <button
        type="button"
        className="celebration-toast__dismiss"
        aria-label={`Dismiss ${toast.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onDismiss(toast.id);
        }}
      >
        ✕
      </button>
    </article>
  );
}

export default function App() {
  const appScopeRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [targetFormat, setTargetFormat] = useState('png');
  const [convertedFiles, setConvertedFiles] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [convertingMap, setConvertingMap] = useState({});
  const [convertingProgress, setConvertingProgress] = useState({});
  const [processing, setProcessing] = useState([]);
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [isHydratingQueue, setIsHydratingQueue] = useState(true);
  const [activePanel, setActivePanel] = useState(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEYS.activePanel) || null;
  });
  const [menuCollapsed, setMenuCollapsed] = useState(() => parseBooleanStorage(STORAGE_KEYS.menuCollapsed, false));
  const [quality, setQuality] = useState(() => parseNumberStorage(STORAGE_KEYS.quality) ?? QUALITY_DEFAULT);
  const [resizeWidth, setResizeWidth] = useState(() => parseNumberStorage(STORAGE_KEYS.width));
  const [resizeHeight, setResizeHeight] = useState(() => parseNumberStorage(STORAGE_KEYS.height));
  const [keepAspectRatio, setKeepAspectRatio] = useState(() => parseBooleanStorage(STORAGE_KEYS.keepAspectRatio, true));
  const [autoClearOnExit, setAutoClearOnExit] = useState(() => parseBooleanStorage(STORAGE_KEYS.autoClearOnExit, false));
  const [stripMetadata, setStripMetadata] = useState(() => parseBooleanStorage(STORAGE_KEYS.stripMetadata, false));
  const [preserveMetadata, setPreserveMetadata] = useState(() => parseBooleanStorage(STORAGE_KEYS.preserveMetadata, false));
  const [filenameConvention, setFilenameConvention] = useState(() => {
    if (typeof window === 'undefined') return 'original';
    return window.localStorage.getItem(STORAGE_KEYS.filenameConvention) || 'original';
  });
  const [customFilenamePattern, setCustomFilenamePattern] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(STORAGE_KEYS.customFilenamePattern) || '';
  });
  const [preserveFolderStructure, setPreserveFolderStructure] = useState(() => parseBooleanStorage(STORAGE_KEYS.preserveFolderStructure, false));
  const [darkMode, setDarkMode] = useState(() => parseOptionalBooleanStorage(STORAGE_KEYS.darkMode));
  const [reducedMotion, setReducedMotion] = useState(() => parseOptionalBooleanStorage(STORAGE_KEYS.reducedMotion));
  const [celebrationSoundEnabled, setCelebrationSoundEnabled] = useState(() => parseBooleanStorage(STORAGE_KEYS.celebrationSoundEnabled, true));
  const [editingSession, setEditingSession] = useState(null);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false));
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false));
  const [imageMetrics, setImageMetrics] = useState({ originalSize: 0, originalWidth: 0, originalHeight: 0 });
  const [achievementsState, setAchievementsState] = useState(() => loadAchievementsState());
  const [achievementGalleryOpen, setAchievementGalleryOpen] = useState(true);
  const [celebrationStats, setCelebrationStats] = useState(() => parseCelebrationStorage());
  const [xpState, setXpState] = useState(() => loadXpState());
  const [dailyGoal, setDailyGoal] = useState(() => clampDailyGoal(parseNumberStorage(STORAGE_KEYS.dailyGoal) ?? 10));
  const [dailyGoalState, setDailyGoalState] = useState(() => {
    if (typeof window === 'undefined') return createDefaultDailyGoalState();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.dailyGoalState);
      return raw ? normalizeDailyGoalState(JSON.parse(raw)) : createDefaultDailyGoalState();
    } catch (error) {
      console.warn('[daily-goal] failed to parse stored state, resetting', error);
      return createDefaultDailyGoalState();
    }
  });
  const [dailyGoalCelebrationKey, setDailyGoalCelebrationKey] = useState(0);
  const [dailyGoalMilestone, setDailyGoalMilestone] = useState(null);
  const [celebrationToasts, setCelebrationToasts] = useState([]);
  const [confettiBursts, setConfettiBursts] = useState([]);
  const [xpBursts, setXpBursts] = useState([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('weekly');
  const [gamificationTab, setGamificationTab] = useState(() => {
    if (typeof window === 'undefined') return 'leaderboards';
    return window.localStorage.getItem(STORAGE_KEYS.gamificationTab) || 'leaderboards';
  });
  const [magicMoments, setMagicMoments] = useState(() => loadJsonStorage(STORAGE_KEYS.magicMoments, DEFAULT_MAGIC_MOMENTS));
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [aiState, setAiState] = useState(() => loadJsonStorage(STORAGE_KEYS.aiState, DEFAULT_AI_STATE));
  const [aiHistory, setAiHistory] = useState(() => [loadJsonStorage(STORAGE_KEYS.aiState, DEFAULT_AI_STATE)]);
  const [aiHistoryIndex, setAiHistoryIndex] = useState(0);
  const [aiSkipMap, setAiSkipMap] = useState(() => loadJsonStorage(STORAGE_KEYS.aiSkipMap, {}));
  const [powerUps, setPowerUps] = useState(() => loadJsonStorage(STORAGE_KEYS.powerUps, DEFAULT_POWER_UPS));

  const pausedRef = useRef(paused);
  const abortControllersRef = useRef({});
  const currentRunIdRef = useRef(0);
  const filesRef = useRef(files);
  const convertedFilesRef = useRef(convertedFiles);
  const processingRef = useRef(processing);
  const audioContextRef = useRef(null);
  const autoToastTimeoutsRef = useRef({});
  const previousConvertedCountRef = useRef(convertedFiles.length);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    convertedFilesRef.current = convertedFiles;
  }, [convertedFiles]);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  const formatValidation = useMemo(() => {
    const sameFormatFiles = files.filter((file) => getFileExtension(file) === targetFormat);
    const convertibleFiles = files.filter((file) => getFileExtension(file) !== targetFormat);
    const allFilesMatchTarget = files.length > 0 && sameFormatFiles.length === files.length;

    let message = '';
    if (allFilesMatchTarget) {
      message = `All uploaded files are already ${targetFormat.toUpperCase()}. Choose another target format to continue.`;
    } else if (sameFormatFiles.length > 0) {
      message = `${sameFormatFiles.length} file${sameFormatFiles.length > 1 ? 's already match' : ' already matches'} ${targetFormat.toUpperCase()} and will be skipped.`;
    }

    return {
      sameFormatFiles,
      convertibleFiles,
      allFilesMatchTarget,
      hasConflict: sameFormatFiles.length > 0,
      message,
    };
  }, [files, targetFormat]);

  const queueSummary = useMemo(() => ({
    pending: files.length,
    converted: convertedFiles.length,
    total: files.length + convertedFiles.length,
    processing: processing.length,
  }), [convertedFiles.length, files.length, processing.length]);

  const achievements = useMemo(() => getAchievementsView(achievementsState), [achievementsState]);
  const unlockedAchievementsCount = useMemo(() => achievements.filter((achievement) => achievement.unlocked).length, [achievements]);

  const canConvert = useMemo(
    () => formatValidation.convertibleFiles.length > 0 && !isConverting && !paused,
    [formatValidation.convertibleFiles.length, isConverting, paused],
  );
  const canDownloadZip = useMemo(() => convertedFiles.length > 0 && !isDownloadingZip, [convertedFiles.length, isDownloadingZip]);
  const canClearAll = useMemo(() => (files.length > 0 || convertedFiles.length > 0) && !isConverting, [convertedFiles.length, files.length, isConverting]);
  const resolvedReducedMotion = reducedMotion === null ? systemPrefersReducedMotion : reducedMotion;
  const dailyGoalProgress = useMemo(() => {
    if (!dailyGoal) return 0;
    return Math.min(100, Math.round((dailyGoalState.count / dailyGoal) * 100));
  }, [dailyGoal, dailyGoalState.count]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (activePanel) {
      window.localStorage.setItem(STORAGE_KEYS.activePanel, activePanel);
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.activePanel);
  }, [activePanel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.menuCollapsed, String(menuCollapsed));
  }, [menuCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.quality, String(quality));
  }, [quality]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (resizeWidth == null) {
      window.localStorage.removeItem(STORAGE_KEYS.width);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.width, String(resizeWidth));
  }, [resizeWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (resizeHeight == null) {
      window.localStorage.removeItem(STORAGE_KEYS.height);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.height, String(resizeHeight));
  }, [resizeHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.keepAspectRatio, String(keepAspectRatio));
  }, [keepAspectRatio]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.autoClearOnExit, String(autoClearOnExit));
  }, [autoClearOnExit]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.stripMetadata, String(stripMetadata));
  }, [stripMetadata]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.preserveMetadata, String(preserveMetadata));
  }, [preserveMetadata]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.filenameConvention, filenameConvention);
  }, [filenameConvention]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.customFilenamePattern, customFilenamePattern);
  }, [customFilenamePattern]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.preserveFolderStructure, String(preserveFolderStructure));
  }, [preserveFolderStructure]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleDarkChange = (event) => setSystemPrefersDark(event.matches);
    const handleMotionChange = (event) => setSystemPrefersReducedMotion(event.matches);

    setSystemPrefersDark(darkMedia.matches);
    setSystemPrefersReducedMotion(motionMedia.matches);

    darkMedia.addEventListener('change', handleDarkChange);
    motionMedia.addEventListener('change', handleMotionChange);

    return () => {
      darkMedia.removeEventListener('change', handleDarkChange);
      motionMedia.removeEventListener('change', handleMotionChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.darkMode, String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.reducedMotion, String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.celebrationSoundEnabled, String(celebrationSoundEnabled));
  }, [celebrationSoundEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.celebrationStats, JSON.stringify(celebrationStats));
  }, [celebrationStats]);

  useEffect(() => {
    persistAchievementsState(achievementsState);
  }, [achievementsState]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePageHide = () => {
      setAchievementsState((current) => resetSessionAchievements(current));
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.dailyGoal, String(dailyGoal));
  }, [dailyGoal]);

  useEffect(() => {
    const today = getLocalDateKey();
    setDailyGoalState((current) => {
      const normalized = normalizeDailyGoalState(current);
      if (normalized.completedToday || normalized.count < dailyGoal || normalized.lastActiveDate !== today) {
        return normalized;
      }

      const nextStreak = getDayDiff(normalized.lastCompletedDate, today) === 1 ? normalized.streak + 1 : 1;
      return {
        ...normalized,
        completedToday: true,
        streak: nextStreak,
        lastCompletedDate: today,
      };
    });
  }, [dailyGoal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.dailyGoalState, JSON.stringify(dailyGoalState));
  }, [dailyGoalState]);

  useEffect(() => {
    const syncDailyGoalDay = () => {
      const today = getLocalDateKey();
      setDailyGoalState((current) => {
        const normalized = normalizeDailyGoalState(current);
        if (normalized.lastActiveDate === today) return normalized;

        const daysSinceCompletion = getDayDiff(normalized.lastCompletedDate, today);
        return {
          ...normalized,
          count: 0,
          completedToday: false,
          streak: daysSinceCompletion === 1 ? normalized.streak : 0,
          lastActiveDate: today,
          lastResetAt: new Date().toISOString(),
        };
      });
      setDailyGoalMilestone(null);
    };

    syncDailyGoalDay();
    const intervalId = window.setInterval(syncDailyGoalDay, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isHydratingQueue) return;

    const previousCount = previousConvertedCountRef.current;
    const nextCount = convertedFiles.length;
    previousConvertedCountRef.current = nextCount;

    if (nextCount <= previousCount) return;

    const delta = nextCount - previousCount;
    const today = getLocalDateKey();

    setDailyGoalState((current) => {
      const normalized = normalizeDailyGoalState(current);
      const refreshed = normalized.lastActiveDate === today
        ? normalized
        : {
          ...normalized,
          count: 0,
          completedToday: false,
          streak: getDayDiff(normalized.lastCompletedDate, today) === 1 ? normalized.streak : 0,
          lastActiveDate: today,
          lastResetAt: new Date().toISOString(),
        };

      const nextDailyCount = refreshed.count + delta;
      const reachedGoal = !refreshed.completedToday && nextDailyCount >= dailyGoal;
      const nextMilestone = reachedGoal
        ? (getDayDiff(refreshed.lastCompletedDate, today) === 1 ? refreshed.streak + 1 : 1)
        : refreshed.streak;

      if (reachedGoal) {
        const milestone = [3, 7, 30].find((value) => value === nextMilestone) || null;
        setDailyGoalCelebrationKey((value) => value + 1);
        setDailyGoalMilestone(milestone);
        celebrate({
          toast: {
            variant: 'goal',
            icon: milestone ? '🔥' : '🎯',
            title: milestone ? `${milestone}-day streak unlocked` : 'Daily Goal Met',
            description: milestone
              ? `You hit today’s conversion target and extended your streak to ${nextMilestone} days.`
              : `You crushed today’s ${dailyGoal}-image target.`,
          },
          confetti: { variant: 'goal', intensity: milestone ? 24 : 18, accent: 'Daily goal met' },
          xp: { amount: milestone ? 100 : 50, label: milestone ? `${milestone}-day streak` : 'Daily goal met', variant: 'goal' },
          sound: 'streak',
        });
      }

      return {
        ...refreshed,
        count: nextDailyCount,
        completedToday: refreshed.completedToday || reachedGoal,
        streak: reachedGoal ? nextMilestone : refreshed.streak,
        lastCompletedDate: reachedGoal ? today : refreshed.lastCompletedDate,
      };
    });
  }, [convertedFiles.length, dailyGoal, isHydratingQueue]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const resolvedTheme = darkMode === null ? (systemPrefersDark ? 'dark' : 'light') : (darkMode ? 'dark' : 'light');
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [darkMode, systemPrefersDark]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const shouldReduceMotion = reducedMotion === null ? systemPrefersReducedMotion : reducedMotion;
    document.body.classList.toggle('reduced-motion', shouldReduceMotion);
  }, [reducedMotion, systemPrefersReducedMotion]);

  useEffect(() => {
    persistXpState(xpState);
  }, [xpState]);

  useEffect(() => {
    const today = getTodayStamp();
    const stats = normalizeCelebrationStats(celebrationStats);
    const elapsedSinceActive = getDaysBetween(stats.lastActiveDate, today);
    const elapsedSinceWeeklyStart = getDaysBetween(stats.weeklyWindowStart, today);
    let nextStats = stats;

    if (elapsedSinceWeeklyStart >= 7 || elapsedSinceWeeklyStart < 0) {
      if (stats.weeklyConversions >= 10) {
        celebrate({
          toast: {
            variant: 'weekly',
            icon: '🗓️',
            title: 'Weekly summary',
            description: `You wrapped the last 7 days with ${stats.weeklyConversions} conversions.`,
          },
          sound: 'streak',
        });
      }

      nextStats = {
        ...nextStats,
        weeklyConversions: 0,
        weeklyWindowStart: today,
      };
    }

    if (elapsedSinceActive === 1) {
      const streak = stats.currentStreak + 1;
      nextStats = {
        ...nextStats,
        currentStreak: streak,
        bestStreak: Math.max(stats.bestStreak, streak),
        lastActiveDate: today,
      };

      celebrate({
        toast: {
          variant: 'streak',
          icon: streak >= 3 ? '🔥' : '✨',
          title: streak >= 3 ? 'Streak Master' : 'Daily streak updated',
          description: streak >= 3 ? `${streak} days in a row. Momentum unlocked.` : `Day ${streak} in a row. Keep the streak alive.`,
        },
        confetti: streak >= 3 ? { variant: 'streak', intensity: 18, accent: `${streak} day streak` } : null,
        sound: 'streak',
      });
    } else if (elapsedSinceActive > 1 || elapsedSinceActive < 0) {
      if (powerUps.streakSaveArmed && elapsedSinceActive === 2) {
        nextStats = {
          ...nextStats,
          lastActiveDate: today,
        };
        setPowerUps((current) => ({ ...current, streakSaveArmed: false }));

        celebrate({
          toast: {
            variant: 'streak',
            icon: '🛡️',
            title: 'Streak save consumed',
            description: 'Your shield protected a missed day and kept momentum alive.',
          },
          sound: 'streak',
        });
      } else {
        nextStats = {
          ...nextStats,
          currentStreak: 1,
          lastActiveDate: today,
        };

        celebrate({
          toast: {
            variant: 'streak',
            icon: '🌅',
            title: 'Fresh streak started',
            description: 'Welcome back. Your streak has been reset and is ready to build again.',
          },
        });
      }
    }

    if (JSON.stringify(nextStats) !== JSON.stringify(stats)) {
      setCelebrationStats(nextStats);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerUps.streakSaveArmed]);

  useEffect(() => () => {
    Object.values(autoToastTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    audioContextRef.current?.close?.().catch?.(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const isEditableTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    };

    const panelShortcuts = ['settings', 'ai', 'gamification', 'quality', 'size', 'queue', 'privacy', 'filename', 'progress'];

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (editingSession) {
          setEditingSession(null);
          return;
        }

        if (isKeyboardShortcutsOpen) {
          setIsKeyboardShortcutsOpen(false);
          return;
        }

        if (activePanel) {
          setActivePanel(null);
        }
        return;
      }

      const editableTarget = isEditableTarget(event.target);
      const lowerKey = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && lowerKey === 'k') {
        event.preventDefault();
        setIsKeyboardShortcutsOpen(true);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && lowerKey === 'l') {
        event.preventDefault();
        setActivePanel((current) => (current === 'gamification' ? null : 'gamification'));
        setMenuCollapsed(false);
        return;
      }

      if (editableTarget) return;

      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setIsKeyboardShortcutsOpen(true);
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const panelId = panelShortcuts[Number(event.key) - 1];
        setActivePanel((current) => (current === panelId ? null : panelId));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, editingSession, isKeyboardShortcutsOpen]);

  useEffect(() => {
    if (!autoClearOnExit || typeof window === 'undefined') return undefined;

    const handleBeforeUnload = () => {
      Object.values(abortControllersRef.current).forEach((controller) => controller.abort());
      void clearPrivacyStorage();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autoClearOnExit]);

  useEffect(() => {
    let cancelled = false;

    const hydrateQueue = async () => {
      if (typeof window === 'undefined') return;

      try {
        const raw = window.localStorage.getItem(STORAGE_KEYS.queue);
        if (!raw) {
          console.log('[queue:hydrate] nothing in localStorage');
          return;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          console.warn('[queue:hydrate] invalid payload shape');
          return;
        }

        const hydratedQueue = await Promise.all((parsed.queue || []).map(deserializeQueueFile));
        if (cancelled) return;

        setFiles(hydratedQueue);
        setConvertedFiles(Array.isArray(parsed.converted) ? parsed.converted : []);
        setPaused(Boolean(parsed.paused));
        setProcessing(Array.isArray(parsed.processing) ? parsed.processing : []);

        const total = hydratedQueue.length + (Array.isArray(parsed.converted) ? parsed.converted.length : 0);
        const completed = Array.isArray(parsed.converted) ? parsed.converted.length : 0;
        setProgress(total ? Math.round((completed / total) * 100) : 0);

        console.log('[queue:hydrate] loaded', {
          queueLength: hydratedQueue.length,
          convertedLength: Array.isArray(parsed.converted) ? parsed.converted.length : 0,
          paused: Boolean(parsed.paused),
          processingLength: Array.isArray(parsed.processing) ? parsed.processing.length : 0,
          names: hydratedQueue.map((file) => file.name),
        });
      } catch (error) {
        console.error('[queue:hydrate] failed, clearing persisted queue', error);
        window.localStorage.removeItem(STORAGE_KEYS.queue);
      } finally {
        if (!cancelled) setIsHydratingQueue(false);
      }
    };

    hydrateQueue();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isHydratingQueue || typeof window === 'undefined') return;

    let cancelled = false;
    const persistQueue = async () => {
      try {
        await persistQueueState({ files, convertedFiles, paused, processing });
        if (cancelled) return;
      } catch (error) {
        console.error('[queue:persist] failed', error);
      }
    };

    persistQueue();

    return () => {
      cancelled = true;
    };
  }, [convertedFiles, files, isHydratingQueue, paused, processing]);

  useEffect(() => {
    setImageMetrics(getMinOriginalDimensions(files));
  }, [files]);

  useEffect(() => {
    const maxAllowedWidth = imageMetrics.originalWidth || 4000;
    const maxAllowedHeight = imageMetrics.originalHeight || 4000;

    if (resizeWidth != null) {
      const cappedWidth = clampDimension(resizeWidth, maxAllowedWidth);
      if (cappedWidth !== resizeWidth) {
        setResizeWidth(cappedWidth);
      }
    }

    if (resizeHeight != null) {
      const cappedHeight = clampDimension(resizeHeight, maxAllowedHeight);
      if (cappedHeight !== resizeHeight) {
        setResizeHeight(cappedHeight);
      }
    }
  }, [imageMetrics.originalHeight, imageMetrics.originalWidth, resizeHeight, resizeWidth]);

  useEffect(() => {
    const originalWidth = imageMetrics.originalWidth || null;
    const originalHeight = imageMetrics.originalHeight || null;

    if (!originalWidth || !originalHeight || !keepAspectRatio) return;

    if (resizeWidth != null && resizeHeight == null) {
      setResizeHeight(clampDimension((resizeWidth / originalWidth) * originalHeight, originalHeight));
      return;
    }

    if (resizeHeight != null && resizeWidth == null) {
      setResizeWidth(clampDimension((resizeHeight / originalHeight) * originalWidth, originalWidth));
    }
  }, [imageMetrics.originalHeight, imageMetrics.originalWidth, keepAspectRatio, resizeHeight, resizeWidth]);

  const estimatedSizeBytes = useMemo(
    () => estimateOutputSize({
      originalSize: imageMetrics.originalSize,
      originalWidth: imageMetrics.originalWidth,
      originalHeight: imageMetrics.originalHeight,
      width: resizeWidth,
      height: resizeHeight,
      quality,
      targetFormat,
    }),
    [imageMetrics.originalHeight, imageMetrics.originalSize, imageMetrics.originalWidth, quality, resizeHeight, resizeWidth, targetFormat],
  );

  const settingsState = useMemo(() => ({
    quality,
    width: resizeWidth,
    height: resizeHeight,
    keepAspectRatio,
    autoClearOnExit,
    stripMetadata,
    originalSize: imageMetrics.originalSize,
    originalWidth: imageMetrics.originalWidth,
    originalHeight: imageMetrics.originalHeight,
    maxAllowedWidth: imageMetrics.originalWidth,
    maxAllowedHeight: imageMetrics.originalHeight,
    estimatedSizeBytes,
    estimatedSizeLabel: formatBytes(estimatedSizeBytes),
    qualityAppliesToTarget: QUALITY_FORMATS.has(targetFormat),
    targetFormat,
    preserveMetadata,
    filenameConvention,
    customFilenamePattern,
    preserveFolderStructure,
    darkMode,
    reducedMotion,
    celebrationSoundEnabled,
    resolvedDarkMode: darkMode === null ? systemPrefersDark : darkMode,
    resolvedReducedMotion: reducedMotion === null ? systemPrefersReducedMotion : reducedMotion,
  }), [autoClearOnExit, celebrationSoundEnabled, customFilenamePattern, darkMode, estimatedSizeBytes, filenameConvention, imageMetrics.originalHeight, imageMetrics.originalSize, imageMetrics.originalWidth, keepAspectRatio, preserveFolderStructure, preserveMetadata, quality, reducedMotion, resizeHeight, resizeWidth, stripMetadata, systemPrefersDark, systemPrefersReducedMotion, targetFormat]);

  const leaderboard = useMemo(() => getLeaderboardSnapshot({
    weeklyConversions: celebrationStats.weeklyConversions,
    totalConversions: achievementsState.totalConverted,
    streakDays: achievementsState.streakDays,
  }), [achievementsState.streakDays, achievementsState.totalConverted, celebrationStats.weeklyConversions]);
  const activeLeaderboard = leaderboardPeriod === 'monthly' ? leaderboard.monthly : leaderboard.weekly;
  const xpMultiplierRemainingMs = powerUps.xpMultiplierEndsAt ? new Date(powerUps.xpMultiplierEndsAt).getTime() - nowTick : 0;
  const xpMultiplierActive = xpMultiplierRemainingMs > 0;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const intervalId = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.aiState, JSON.stringify(aiState));
  }, [aiState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.aiSkipMap, JSON.stringify(aiSkipMap));
  }, [aiSkipMap]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.powerUps, JSON.stringify(powerUps));
  }, [powerUps]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.gamificationTab, gamificationTab);
  }, [gamificationTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.magicMoments, JSON.stringify(magicMoments));
  }, [magicMoments]);

  const pushAiHistory = (nextState) => {
    setAiState(nextState);
    setAiHistory((current) => [...current.slice(0, aiHistoryIndex + 1), nextState]);
    setAiHistoryIndex((current) => current + 1);
  };

  const handleAiChange = (key, value) => {
    pushAiHistory({ ...aiState, [key]: value });
  };

  const handleAiUndo = () => {
    if (aiHistoryIndex <= 0) return;
    const nextIndex = aiHistoryIndex - 1;
    setAiHistoryIndex(nextIndex);
    setAiState(aiHistory[nextIndex]);
  };

  const handleAiRedo = () => {
    if (aiHistoryIndex >= aiHistory.length - 1) return;
    const nextIndex = aiHistoryIndex + 1;
    setAiHistoryIndex(nextIndex);
    setAiState(aiHistory[nextIndex]);
  };

  const handleToggleAiSkip = (fileKey) => {
    setAiSkipMap((current) => ({ ...current, [fileKey]: !current[fileKey] }));
  };

  const handleReplayMagicMoment = (moment) => {
    if (!moment) return;
    celebrate({
      toast: {
        variant: 'batch',
        icon: moment.milestone >= 100 ? '👑' : moment.milestone >= 50 ? '🌌' : '🌠',
        title: `${moment.milestone}th Conversion!`,
        description: `Replaying ${moment.label.toLowerCase()} from the local lab archive.`,
      },
      confetti: { variant: 'batch', intensity: moment.milestone >= 100 ? 44 : moment.milestone >= 50 ? 38 : 30, accent: `${moment.milestone}th conversion` },
      sound: 'batch',
    });
  };

  const handleShareAchievement = async () => {
    const text = `IFC AI Lab flex — ${achievementsState.totalConverted} conversions, ${achievementsState.streakDays}-day streak, ${leaderboard.weekly.scoreLabel}.`;

    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      celebrate({
        toast: { variant: 'achievement', icon: '📣', title: 'Share card copied', description: text },
        sound: 'achievement',
      });
    } catch {
      celebrate({
        toast: { variant: 'achievement', icon: '📣', title: 'Share ready', description: text },
      });
    }
  };

  const handleActivateXpMultiplier = () => {
    if (xpMultiplierActive) return;
    setPowerUps((current) => ({ ...current, xpMultiplierEndsAt: new Date(Date.now() + 3600000).toISOString() }));
    celebrate({
      toast: {
        variant: 'goal',
        icon: '⚡',
        title: '2x XP power-up armed',
        description: 'You have one hour of boosted XP on every conversion run.',
      },
      confetti: { variant: 'goal', intensity: 20, accent: '2x XP activated' },
      xp: { amount: 75, label: '2x XP boost', variant: 'goal' },
      sound: 'achievement',
    });
  };

  const handleToggleAchievementBoost = () => {
    setPowerUps((current) => {
      const nextEnabled = !current.achievementBoost;
      celebrate({
        toast: {
          variant: 'achievement',
          icon: nextEnabled ? '✨' : '🌙',
          title: nextEnabled ? 'Achievement boost online' : 'Achievement boost muted',
          description: nextEnabled ? 'Big unlock celebrations are back in full neon.' : 'Celebrations will stay subtle until you re-arm them.',
        },
      });
      return { ...current, achievementBoost: nextEnabled };
    });
  };

  const handleArmStreakSave = () => {
    if (powerUps.streakSaveArmed) return;
    setPowerUps((current) => ({ ...current, streakSaveArmed: true }));
    celebrate({
      toast: {
        variant: 'streak',
        icon: '🛡️',
        title: 'Streak shield recharged',
        description: 'One missed day can now be absorbed without breaking momentum.',
      },
      confetti: { variant: 'streak', intensity: 16, accent: 'Streak shield ready' },
      sound: 'streak',
    });
  };

  const dismissCelebrationToast = (toastId) => {
    if (autoToastTimeoutsRef.current[toastId]) {
      window.clearTimeout(autoToastTimeoutsRef.current[toastId]);
      delete autoToastTimeoutsRef.current[toastId];
    }
    setCelebrationToasts((current) => current.filter((item) => item.id !== toastId));
  };

  const spawnToast = (toast) => {
    const id = toast.id || `${toast.variant || 'celebration'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextToast = { ...toast, id };

    setCelebrationToasts((current) => [...current.slice(-2), nextToast]);

    if (typeof window !== 'undefined') {
      autoToastTimeoutsRef.current[id] = window.setTimeout(() => {
        dismissCelebrationToast(id);
      }, toast.duration ?? 4400);
    }
  };

  const spawnConfetti = ({ variant = 'achievement', intensity = 16, accent = targetFormat.toUpperCase() } = {}) => {
    const burstId = `${variant}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const particles = Array.from({ length: intensity }, (_, index) => ({
      id: `${burstId}-particle-${index}`,
      left: `${8 + Math.random() * 84}%`,
      delay: Math.random() * 0.18,
      duration: 0.9 + Math.random() * 0.9,
      size: 8 + Math.round(Math.random() * 8),
      rotation: -140 + Math.random() * 280,
      x: -140 + Math.random() * 280,
      y: 150 + Math.random() * 160,
      color: ['#57e1ff', '#ff8a5b', '#d7ff63', '#ffffff', '#a78bfa'][index % 5],
      shape: index % 3 === 0 ? 'circle' : index % 3 === 1 ? 'diamond' : 'strip',
    }));

    setConfettiBursts((current) => [...current, { id: burstId, variant, accent, particles }]);
    window.setTimeout(() => {
      setConfettiBursts((current) => current.filter((item) => item.id !== burstId));
    }, 2600);
  };

  const spawnXpBurst = ({ amount, label, variant = 'xp' }) => {
    const id = `${variant}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setXpBursts((current) => [...current, { id, amount, label, variant }]);
    window.setTimeout(() => {
      setXpBursts((current) => current.filter((item) => item.id !== id));
    }, 2200);
  };

  const playCelebrationSound = (variant = 'achievement') => {
    if (typeof window === 'undefined' || !celebrationSoundEnabled) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      const startAt = context.currentTime + 0.01;
      const master = context.createGain();
      master.gain.value = variant === 'batch' ? 0.05 : 0.035;
      master.connect(context.destination);

      const notes = variant === 'batch' ? [392, 523.25, 659.25] : variant === 'streak' ? [349.23, 440, 523.25] : [523.25, 659.25];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = variant === 'batch' ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, startAt + index * 0.06);
        gain.gain.exponentialRampToValueAtTime(variant === 'batch' ? 0.18 : 0.12, startAt + index * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + index * 0.06 + 0.22);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(startAt + index * 0.06);
        oscillator.stop(startAt + index * 0.06 + 0.24);
      });
    } catch (error) {
      console.warn('[celebration:sound] playback skipped', error);
    }
  };

  const celebrate = ({ toast, confetti, xp, sound }) => {
    const shouldReduceMotion = reducedMotion === null ? systemPrefersReducedMotion : reducedMotion;
    if (toast) spawnToast(toast);
    if (xp) spawnXpBurst(xp);
    if (!shouldReduceMotion && confetti) spawnConfetti(confetti);
    if (sound) playCelebrationSound(sound);
  };

  const handleSettingsChange = (key, value) => {
    if (key === 'quality') {
      setQuality(Math.max(0, Math.min(100, Number(value) || 0)));
      return;
    }

    if (key === 'keepAspectRatio') {
      const nextKeepAspectRatio = Boolean(value);
      setKeepAspectRatio(nextKeepAspectRatio);
      if (nextKeepAspectRatio && imageMetrics.originalWidth && imageMetrics.originalHeight) {
        if (resizeWidth != null) {
          setResizeHeight(clampDimension((resizeWidth / imageMetrics.originalWidth) * imageMetrics.originalHeight, imageMetrics.originalHeight));
        } else if (resizeHeight != null) {
          setResizeWidth(clampDimension((resizeHeight / imageMetrics.originalHeight) * imageMetrics.originalWidth, imageMetrics.originalWidth));
        }
      }
      return;
    }

    if (key === 'autoClearOnExit') {
      setAutoClearOnExit(Boolean(value));
      return;
    }

    if (key === 'stripMetadata') {
      const nextStripMetadata = Boolean(value);
      setStripMetadata(nextStripMetadata);
      if (nextStripMetadata) setPreserveMetadata(false);
      return;
    }

    if (key === 'preserveMetadata') {
      const nextPreserveMetadata = Boolean(value);
      setPreserveMetadata(nextPreserveMetadata);
      if (nextPreserveMetadata) setStripMetadata(false);
      return;
    }

    if (key === 'filenameConvention') {
      setFilenameConvention(String(value || 'original'));
      return;
    }

    if (key === 'customFilenamePattern') {
      setCustomFilenamePattern(String(value || ''));
      return;
    }

    if (key === 'preserveFolderStructure') {
      setPreserveFolderStructure(Boolean(value));
      return;
    }

    if (key === 'darkMode') {
      setDarkMode(value === 'auto' ? null : Boolean(value));
      return;
    }

    if (key === 'reducedMotion') {
      setReducedMotion(value === 'auto' ? null : Boolean(value));
      return;
    }

    if (key === 'celebrationSoundEnabled') {
      setCelebrationSoundEnabled(Boolean(value));
      return;
    }

    if (key === 'width') {
      if (value == null) {
        setResizeWidth(null);
        if (keepAspectRatio) setResizeHeight(null);
        return;
      }

      const safeWidth = clampDimension(value, imageMetrics.originalWidth || 4000);
      setResizeWidth(safeWidth);
      if (keepAspectRatio && safeWidth && imageMetrics.originalWidth && imageMetrics.originalHeight) {
        setResizeHeight(clampDimension((safeWidth / imageMetrics.originalWidth) * imageMetrics.originalHeight, imageMetrics.originalHeight));
      }
      return;
    }

    if (key === 'height') {
      if (value == null) {
        setResizeHeight(null);
        if (keepAspectRatio) setResizeWidth(null);
        return;
      }

      const safeHeight = clampDimension(value, imageMetrics.originalHeight || 4000);
      setResizeHeight(safeHeight);
      if (keepAspectRatio && safeHeight && imageMetrics.originalWidth && imageMetrics.originalHeight) {
        setResizeWidth(clampDimension((safeHeight / imageMetrics.originalHeight) * imageMetrics.originalWidth, imageMetrics.originalWidth));
      }
    }
  };

  const addFiles = async (incomingFiles) => {
    setErrorMessage('');
    setProgress(0);

    const enrichedIncomingFiles = await Promise.all(incomingFiles.map(async (file) => Object.assign(file, await readImageDimensions(file))));

    const nextFiles = (() => {
      const deduped = new Map(filesRef.current.map((file) => [getFileKey(file), file]));
      enrichedIncomingFiles.forEach((file) => {
        deduped.set(getFileKey(file), Object.assign(file, {
          rotation: normalizeRotation(file.rotation),
          crop: normalizeCrop(file.crop),
        }));
      });
      return Array.from(deduped.values());
    })();

    console.log('[queue:add] files added', nextFiles.map((file) => file.name));
    setFiles(nextFiles);
    filesRef.current = nextFiles;

    try {
      await persistQueueState({
        files: nextFiles,
        convertedFiles: convertedFilesRef.current,
        paused: pausedRef.current,
        processing: processingRef.current,
      });
    } catch (error) {
      console.error('[queue:add] immediate persist failed', error);
    }
  };

  const clearProcessingStateForKey = (fileKey) => {
    setProcessing((current) => current.filter((item) => item !== fileKey));
    setActiveTransfers((current) => current.filter((item) => item.id !== fileKey));
    setConvertingMap((current) => {
      const next = { ...current };
      delete next[fileKey];
      return next;
    });
    setConvertingProgress((current) => {
      const next = { ...current };
      delete next[fileKey];
      return next;
    });

    if (abortControllersRef.current[fileKey]) {
      delete abortControllersRef.current[fileKey];
    }
  };

  const handleRemoveFile = (fileToRemove) => {
    const fileKey = getFileKey(fileToRemove);
    if (processing.includes(fileKey)) {
      return;
    }

    setErrorMessage('');
    setFiles((current) => current.filter((file) => getFileKey(file) !== fileKey));
    clearProcessingStateForKey(fileKey);

    setProgress((current) => ((filesRef.current.length - 1 <= 0 && convertedFilesRef.current.length === 0) ? 0 : current));
  };

  const handleCancelItem = (fileToCancel) => {
    const fileKey = getFileKey(fileToCancel);
    setErrorMessage('');

    const controller = abortControllersRef.current[fileKey];
    if (controller) {
      controller.abort();
    }

    clearProcessingStateForKey(fileKey);
    setFiles((current) => current.filter((file) => getFileKey(file) !== fileKey));
  };

  const handleReorder = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

    setFiles((current) => {
      if (fromIndex >= current.length || toIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      console.log('[queue:reorder]', {
        fromIndex,
        toIndex,
        order: next.map((file) => file.name),
      });
      return next;
    });
  };

  const updateFileTransform = (fileToUpdate, updates) => {
    const fileKey = getFileKey(fileToUpdate);
    setFiles((current) => current.map((file) => {
      if (getFileKey(file) !== fileKey) return file;
      return Object.assign(file, updates);
    }));
  };

  const handleRotationChange = (fileToUpdate, nextRotation) => {
    updateFileTransform(fileToUpdate, { rotation: normalizeRotation(nextRotation) });
  };

  const handleCropChange = (fileToUpdate, edge, value) => {
    const nextCrop = normalizeCrop({
      ...(fileToUpdate.crop || DEFAULT_CROP),
      [edge]: value,
    });
    updateFileTransform(fileToUpdate, { crop: nextCrop });
  };

  const handleOpenEditor = (file, focusMode = 'rotate') => {
    setEditingSession({ fileKey: getFileKey(file), focusMode });
  };

  const handleCloseEditor = () => {
    setEditingSession(null);
  };

  const handleSaveEditor = async (fileToUpdate, { rotation, crop }) => {
    const normalizedUpdates = {
      rotation: normalizeRotation(rotation),
      crop: normalizeCrop(crop),
    };
    const thumbnailDataUrl = await generateThumbnailDataUrl(fileToUpdate, normalizedUpdates).catch((error) => {
      console.error('[editor:save] thumbnail generation failed', error);
      return fileToUpdate.thumbnailDataUrl || '';
    });
    const fileKey = getFileKey(fileToUpdate);
    const nextFiles = filesRef.current.map((file) => (
      getFileKey(file) === fileKey ? Object.assign(file, { ...normalizedUpdates, thumbnailDataUrl }) : file
    ));

    setFiles(nextFiles);
    filesRef.current = nextFiles;

    try {
      await persistQueueState({
        files: nextFiles,
        convertedFiles: convertedFilesRef.current,
        paused: pausedRef.current,
        processing: processingRef.current,
      });
    } catch (error) {
      console.error('[editor:save] immediate persist failed', error);
    }

    setEditingSession(null);
  };

  const handleDismissAchievementGallery = () => {
    setAchievementGalleryOpen(false);
  };

  const handleClearAll = () => {
    if (!canClearAll) return;

    const confirmed = window.confirm('Clear all uploaded and converted images? This cannot be undone.');
    if (!confirmed) return;

    Object.values(abortControllersRef.current).forEach((controller) => controller.abort());
    abortControllersRef.current = {};
    currentRunIdRef.current += 1;
    pausedRef.current = false;

    setErrorMessage('');
    setPaused(false);
    setIsConverting(false);
    setFiles([]);
    setConvertedFiles([]);
    setConvertingMap({});
    setConvertingProgress({});
    setProcessing([]);
    setActiveTransfers([]);
    setProgress(0);
    setAchievementsState((current) => resetSessionAchievements(current));
  };

  const handleClearConverted = () => {
    setConvertedFiles([]);
    setErrorMessage('');
    setProgress(files.length ? progress : 0);
  };

  const handleSelectPanel = (panelId) => {
    setActivePanel((current) => (current === panelId ? null : panelId));
    setMenuCollapsed(false);
  };

  const handleToggleMenuCollapsed = () => {
    setMenuCollapsed((current) => !current);
  };

  const handleClosePanel = () => {
    setActivePanel(null);
  };

  const editingFile = editingSession
    ? files.find((file) => getFileKey(file) === editingSession.fileKey) || null
    : null;

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        reduceMotion: reducedMotion === null ? systemPrefersReducedMotion : reducedMotion,
      },
      (context) => {
        const { reduceMotion } = context.conditions;
        const shell = appScopeRef.current;
        if (!shell) return undefined;

        const q = gsap.utils.selector(shell);
        const interactiveSelectors = [
          '.primary-button',
          '.secondary-button',
          '.menu-item',
          '.menu-toggle',
          '.theme-toggle',
          '.image-card',
          '.panel-close',
          '.chip-button',
          '.image-editor-modal__tab',
          '.radio-option',
          '.upload-zone',
        ];

        if (!reduceMotion) {
          gsap.fromTo(
            q('.app-top-chrome, .hero, .progress-block, .split-layout__column, .split-layout__rail'),
            { y: 24, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.9,
              ease: 'power3.out',
              stagger: 0.08,
              clearProps: 'transform',
            },
          );

          gsap.to(q('.background-orb--left'), {
            yPercent: -8,
            xPercent: 4,
            duration: 9,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });

          gsap.to(q('.background-orb--right'), {
            yPercent: 8,
            xPercent: -4,
            duration: 11,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });

          q('[data-reveal]').forEach((element) => {
            gsap.fromTo(
              element,
              { y: 36, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.85,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: element,
                  start: 'top 88%',
                  once: true,
                },
              },
            );
          });

          q('[data-parallax]').forEach((element) => {
            gsap.to(element, {
              yPercent: -10,
              ease: 'none',
              scrollTrigger: {
                trigger: element,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            });
          });
        }

        const cleanups = [];

        interactiveSelectors.forEach((selector) => {
          q(selector).forEach((element) => {
            const hoverIn = () => !reduceMotion && gsap.to(element, { y: -3, scale: 1.01, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
            const hoverOut = () => !reduceMotion && gsap.to(element, { y: 0, scale: 1, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
            const pressIn = () => !reduceMotion && gsap.to(element, { scale: 0.985, duration: 0.12, ease: 'power2.out', overwrite: 'auto' });
            const pressOut = () => !reduceMotion && gsap.to(element, { scale: 1, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
            const focusIn = () => !reduceMotion && gsap.to(element, { boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.12), 0 0 0 6px rgba(87, 225, 255, 0.22)', duration: 0.18, overwrite: 'auto' });
            const focusOut = () => !reduceMotion && gsap.to(element, { boxShadow: '', duration: 0.18, overwrite: 'auto' });

            element.addEventListener('mouseenter', hoverIn);
            element.addEventListener('mouseleave', hoverOut);
            element.addEventListener('pointerdown', pressIn);
            element.addEventListener('pointerup', pressOut);
            element.addEventListener('focus', focusIn);
            element.addEventListener('blur', focusOut);

            cleanups.push(() => {
              element.removeEventListener('mouseenter', hoverIn);
              element.removeEventListener('mouseleave', hoverOut);
              element.removeEventListener('pointerdown', pressIn);
              element.removeEventListener('pointerup', pressOut);
              element.removeEventListener('focus', focusIn);
              element.removeEventListener('blur', focusOut);
            });
          });
        });

        return () => {
          cleanups.forEach((cleanup) => cleanup());
          mm.revert();
        };
      },
    );
  }, { scope: appScopeRef, dependencies: [reducedMotion, systemPrefersReducedMotion, files.length, convertedFiles.length, activePanel, isKeyboardShortcutsOpen, Boolean(editingFile)] });

  useGSAP(() => {
    const shouldReduceMotion = reducedMotion === null ? systemPrefersReducedMotion : reducedMotion;
    const shell = appScopeRef.current;
    if (!shell) return undefined;
    const q = gsap.utils.selector(shell);

    if (!shouldReduceMotion) {
      q('.celebration-confetti__particle').forEach((element) => {
        const particle = element;
        gsap.fromTo(
          particle,
          { y: -40, x: 0, rotate: 0, autoAlpha: 0 },
          {
            y: Number(particle.dataset.y || 180),
            x: Number(particle.dataset.x || 0),
            rotate: Number(particle.dataset.rotation || 0),
            autoAlpha: 1,
            ease: 'power2.out',
            duration: Number(particle.dataset.duration || 1.2),
            delay: Number(particle.dataset.delay || 0),
          },
        );
      });

      q('.xp-burst').forEach((element) => {
        gsap.fromTo(
          element,
          { y: 18, autoAlpha: 0, scale: 0.9 },
          { y: -48, autoAlpha: 1, scale: 1, duration: 1.1, ease: 'power2.out' },
        );
      });

      q('.celebration-toast').forEach((element) => {
        gsap.fromTo(
          element,
          { y: -22, autoAlpha: 0, scale: 0.96 },
          { y: 0, autoAlpha: 1, scale: 1, duration: 0.42, ease: 'power3.out' },
        );
      });
    }

    return undefined;
  }, { scope: appScopeRef, dependencies: [confettiBursts, xpBursts, celebrationToasts, reducedMotion, systemPrefersReducedMotion] });

  const processQueue = async (runId) => {
    const totalAtStart = filesRef.current.length + convertedFilesRef.current.length;
    let completedCount = convertedFilesRef.current.length;
    let shouldStopAfterError = false;
    const batchStartedWith = formatValidation.convertibleFiles.length;
    let processedThisRun = 0;
    let successfulConversions = 0;

    while (!pausedRef.current && !shouldStopAfterError) {
      const nextFile = filesRef.current.find((file) => getFileExtension(file) !== targetFormat);
      if (!nextFile) break;

      const fileKey = getFileKey(nextFile);
      const skipAiProcessing = Boolean(aiSkipMap[fileKey]);
      const applyAiForFile = Boolean(
        aiState.enabled
        && aiState.batchEnabled
        && !skipAiProcessing
        && (aiState.autoEnhance || aiState.backgroundRemoval || aiState.stylePreset !== 'none')
      );
      const stackIndex = processingRef.current.length % MAX_VISIBLE_SWIPE_STACK;
      const controller = new AbortController();
      abortControllersRef.current[fileKey] = controller;

      setProcessing((current) => [...current, fileKey]);
      setConvertingMap((current) => ({ ...current, [fileKey]: { phase: 'swiping' } }));
      setConvertingProgress((current) => ({ ...current, [fileKey]: 18 }));
      setActiveTransfers((current) => [...current, {
        id: fileKey,
        label: `${getFileExtension(nextFile).toUpperCase()}→${targetFormat.toUpperCase()}${applyAiForFile ? ' · AI' : ''}`,
        file: nextFile,
        stackIndex,
      }]);

      try {
        await wait(SWIPE_DURATION_MS);
        if (pausedRef.current || currentRunIdRef.current !== runId) {
          controller.abort();
          break;
        }

        setConvertingMap((current) => ({ ...current, [fileKey]: { phase: 'transitioning' } }));
        setConvertingProgress((current) => ({ ...current, [fileKey]: 62 }));

        const aiReadyFile = (aiState.batchEnabled || filesRef.current.length <= 1) && !aiSkipMap[fileKey] && shouldApplyAi(aiState)
          ? await applyAiProcessing(nextFile, aiState)
          : nextFile;

        const converted = await convertSingle({
          file: aiReadyFile,
          targetFormat,
          quality,
          width: resizeWidth != null ? clampDimension(resizeWidth, nextFile.originalWidth || imageMetrics.originalWidth || 4000) : null,
          height: resizeHeight != null ? clampDimension(resizeHeight, nextFile.originalHeight || imageMetrics.originalHeight || 4000) : null,
          keepAspectRatio,
          stripMetadata,
          preserveMetadata,
          filenameConvention,
          customFilenamePattern,
          preserveFolderStructure,
          rotation: normalizeRotation(nextFile.rotation),
          crop: normalizeCrop(nextFile.crop),
          aiEnabled: applyAiForFile,
          autoEnhance: aiState.autoEnhance,
          removeBackground: aiState.backgroundRemoval,
          stylePreset: aiState.stylePreset,
          styleIntensity: aiState.styleIntensity,
          aiBatchEnabled: aiState.batchEnabled,
          skipAiProcessing,
          signal: controller.signal,
        });

        if (pausedRef.current || currentRunIdRef.current !== runId) {
          break;
        }

        setConvertingMap((current) => ({ ...current, [fileKey]: { phase: 'arrived' } }));
        setConvertingProgress((current) => ({ ...current, [fileKey]: 100 }));
        setConvertedFiles((current) => [...current, converted]);
        setFiles((current) => current.filter((file) => getFileKey(file) !== fileKey));

        completedCount += 1;
        processedThisRun += 1;
        successfulConversions += 1;
        setProgress(totalAtStart ? Math.round((completedCount / totalAtStart) * 100) : 0);

        setCelebrationStats((current) => {
          const updatedStats = normalizeCelebrationStats({
            ...current,
            totalConversions: current.totalConversions + 1,
            weeklyConversions: current.weeklyConversions + 1,
            lastActiveDate: getTodayStamp(),
          });

          celebrate({
            xp: {
              amount: XP_PER_CONVERSION,
              label: 'Conversion complete',
              variant: 'xp',
            },
          });

          const achievementUpdate = registerConversionBatch({
            previousState: achievementsState,
            batchSize: 1,
            targetFormat,
          });

          setAchievementsState(achievementUpdate.state);

          if (achievementUpdate.unlockedAchievements.length) {
            setAchievementGalleryOpen(true);
            achievementUpdate.unlockedAchievements.forEach((achievement) => {
              celebrate({
                toast: {
                  variant: 'achievement',
                  icon: achievement.icon,
                  title: achievement.name,
                  description: achievement.criteria,
                },
                confetti: { variant: 'achievement', intensity: 22, accent: achievement.name },
                sound: 'achievement',
              });
            });
          }

          const unlockedIds = achievementUpdate.achievements
            .filter((achievement) => achievement.unlocked)
            .map((achievement) => achievement.id);

          if ([10, 50, 100].includes(current.totalConversions + 1)) {
            const milestoneValue = current.totalConversions + 1;
            const milestoneLabel = milestoneValue === 10 ? '10th Conversion!' : milestoneValue === 50 ? '50th Conversion!' : '100th Conversion!';
            setMagicMoments((existing) => ({
              ...existing,
              history: [{
                id: `milestone-${milestoneValue}-${Date.now()}`,
                milestone: milestoneValue,
                label: milestoneValue === 100 ? 'Centurion ignition' : milestoneValue === 50 ? 'Half-century burst' : 'First milestone spark',
                timestamp: new Date().toISOString(),
                timestampLabel: new Date().toLocaleString(),
              }, ...(existing.history || [])].slice(0, 12),
            }));
            celebrate({
              toast: {
                variant: 'batch',
                icon: milestoneValue === 100 ? '👑' : milestoneValue === 50 ? '🌌' : '🌠',
                title: milestoneLabel,
                description: milestoneValue === 100
                  ? 'Triple-digit magic unlocked. The local lab is glowing.'
                  : milestoneValue === 50
                    ? 'Half-century hit. Particle burst engaged.'
                    : 'First major milestone reached. Keep the streak hot.',
              },
              confetti: { variant: 'batch', intensity: milestoneValue === 100 ? 44 : milestoneValue === 50 ? 38 : 30, accent: milestoneLabel },
              sound: 'batch',
            });
          }

          const finalStats = normalizeCelebrationStats({
            ...current,
            totalConversions: current.totalConversions + 1,
            weeklyConversions: current.weeklyConversions + 1,
            lastActiveDate: getTodayStamp(),
            currentStreak: Math.max(current.currentStreak, achievementUpdate.state.streakDays || current.currentStreak),
            bestStreak: Math.max(current.bestStreak, achievementUpdate.state.streakDays || current.bestStreak),
            unlockedAchievements: unlockedIds,
          });

          return finalStats;
        });

        await wait(ARRIVAL_DURATION_MS);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          shouldStopAfterError = true;
          setErrorMessage(error.message || `Conversion failed for ${nextFile.name}.`);
        }
      } finally {
        clearProcessingStateForKey(fileKey);
      }
    }

    if (currentRunIdRef.current === runId) {
      setIsConverting(false);
      setProcessing([]);
      setActiveTransfers([]);

      if (successfulConversions > 0) {
        const multiplierActive = powerUps.xpMultiplierEndsAt && new Date(powerUps.xpMultiplierEndsAt).getTime() > Date.now();
        const awardedCount = multiplierActive ? successfulConversions * 2 : successfulConversions;
        setXpState((current) => awardXp(current, { imageCount: awardedCount }).nextState);
      }

      if (!shouldStopAfterError && processedThisRun > 0) {
        celebrate({
          toast: {
            variant: batchStartedWith >= 5 ? 'batch' : 'progress',
            icon: batchStartedWith >= 5 ? '🎉' : '⚡',
            title: batchStartedWith >= 5 ? 'Batch Master unlocked' : 'Batch complete',
            description: batchStartedWith >= 5
              ? `${processedThisRun} images converted in one run. That was a power move.`
              : `${processedThisRun} image${processedThisRun > 1 ? 's' : ''} converted successfully.`,
          },
          confetti: batchStartedWith >= 5 ? { variant: 'batch', intensity: 30, accent: `${processedThisRun} batch` } : { variant: 'progress', intensity: 12, accent: `${processedThisRun} complete` },
          xp: {
            amount: processedThisRun * XP_PER_CONVERSION,
            label: batchStartedWith >= 5 ? `Batch Master · +${processedThisRun * XP_PER_CONVERSION} XP` : `Run complete · +${processedThisRun * XP_PER_CONVERSION} XP`,
            variant: batchStartedWith >= 5 ? 'batch' : 'xp',
          },
          sound: batchStartedWith >= 5 ? 'batch' : 'achievement',
        });
      }
    }
  };

  const handleConvert = async () => {
    if (isConverting || paused) return;

    if (!files.length) {
      setErrorMessage('Upload at least one image before converting.');
      return;
    }

    if (!formatValidation.convertibleFiles.length) {
      setErrorMessage(`All uploaded files are already ${targetFormat.toUpperCase()}. Choose a different format to convert them.`);
      return;
    }

    currentRunIdRef.current += 1;
    const runId = currentRunIdRef.current;
    pausedRef.current = false;

    setPaused(false);
    setIsConverting(true);
    setErrorMessage('');
    if (!convertedFiles.length) {
      setProgress(4);
    }

    await processQueue(runId);
  };

  const handlePause = () => {
    if (!isConverting) return;
    pausedRef.current = true;
    setPaused(true);
    setIsConverting(false);
    Object.values(abortControllersRef.current).forEach((controller) => controller.abort());
  };

  const handleResume = async () => {
    if (!paused) return;
    setErrorMessage('');
    pausedRef.current = false;
    setPaused(false);
    currentRunIdRef.current += 1;
    const runId = currentRunIdRef.current;
    setIsConverting(true);
    await processQueue(runId);
  };

  const downloadConvertedFile = async (file) => {
    if (file.downloadUrl) {
      const response = await fetch(file.downloadUrl);
      if (!response.ok) throw new Error('Could not fetch the converted file.');
      const blob = await response.blob();
      triggerDownload({ blob, filename: file.convertedName });
      return;
    }

    if (file.blobBase64) {
      const blob = base64ToBlob(file.blobBase64, file.mimeType);
      triggerDownload({ blob, filename: file.convertedName });
      return;
    }

    throw new Error('No downloadable file data was provided.');
  };

  const handleDownloadAll = async () => {
    if (!convertedFiles.length) {
      setErrorMessage('Convert files before downloading them.');
      return;
    }

    setErrorMessage('');

    try {
      for (const file of convertedFiles) {
        await downloadConvertedFile(file);
        await wait(200);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Download failed.');
    }
  };

  const handleDownloadZip = async () => {
    if (!convertedFiles.length) {
      setErrorMessage('Convert files before downloading the ZIP archive.');
      return;
    }

    setIsDownloadingZip(true);
    setErrorMessage('');

    try {
      const blob = await createZip({ targetFormat, convertedFiles, preserveFolderStructure });
      triggerDownload({ blob, filename: `converted-images-${targetFormat}.zip` });
    } catch (error) {
      setErrorMessage(error.message || 'ZIP download failed.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="app-shell" ref={appScopeRef}>
      <div className="background-orb background-orb--left" />
      <div className="background-orb background-orb--right" />
      <div className="celebration-layer" aria-hidden="true">
        {confettiBursts.map((burst) => (
          <div key={burst.id} className={`celebration-confetti celebration-confetti--${burst.variant}`} data-accent={burst.accent}>
            {burst.particles.map((particle) => (
              <span
                key={particle.id}
                className={`celebration-confetti__particle celebration-confetti__particle--${particle.shape}`}
                style={{ left: particle.left, width: particle.size, height: particle.size, background: particle.color }}
                data-delay={particle.delay}
                data-duration={particle.duration}
                data-x={particle.x}
                data-y={particle.y}
                data-rotation={particle.rotation}
              />
            ))}
          </div>
        ))}
        <div className="xp-burst-stack">
          {xpBursts.map((burst) => (
            <div key={burst.id} className={`xp-burst xp-burst--${burst.variant}`}>
              <strong>+{burst.amount}</strong>
              <span>{burst.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="celebration-toast-stack">
        {celebrationToasts.map((toast) => (
          <CelebrationToast key={toast.id} toast={toast} onDismiss={dismissCelebrationToast} />
        ))}
      </div>
      <div className="top-right-controls" aria-label="Status and theme controls">
        <OfflineBadge />
        <DarkModeToggle
          darkMode={darkMode}
          resolvedDarkMode={darkMode === null ? systemPrefersDark : darkMode}
          onChange={handleSettingsChange}
        />
      </div>

      <div className="app-top-chrome" data-reveal>
        <MenuBar
          activePanel={activePanel}
          onSelectPanel={handleSelectPanel}
          collapsed={menuCollapsed}
          onToggleCollapsed={handleToggleMenuCollapsed}
        />
        <SettingsPanel
          activePanel={activePanel}
          onClose={handleClosePanel}
          settings={settingsState}
          onChange={handleSettingsChange}
          onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsOpen(true)}
          aiState={aiState}
          onAiChange={handleAiChange}
          onAiUndo={handleAiUndo}
          onAiRedo={handleAiRedo}
          canAiUndo={aiHistoryIndex > 0}
          canAiRedo={aiHistoryIndex < aiHistory.length - 1}
          files={files}
          aiSkipMap={aiSkipMap}
          onToggleAiSkip={handleToggleAiSkip}
          leaderboard={leaderboard}
          onShareAchievement={handleShareAchievement}
          leaderboardPeriod={leaderboardPeriod}
          onLeaderboardPeriodChange={setLeaderboardPeriod}
          moments={magicMoments}
          celebrationSoundEnabled={celebrationSoundEnabled}
          onToggleSound={(enabled) => handleSettingsChange('celebrationSoundEnabled', enabled)}
          onReplayMoment={handleReplayMagicMoment}
          xpMultiplierActive={xpMultiplierRemainingMs > 0}
          xpMultiplierRemainingLabel={xpMultiplierRemainingMs > 0 ? `${Math.ceil(xpMultiplierRemainingMs / 60000)}m remaining` : ''}
          streakSaveArmed={powerUps.streakSaveArmed}
          achievementBoost={powerUps.achievementBoost || false}
          onActivateXpMultiplier={handleActivateXpMultiplier}
          onArmStreakSave={handleArmStreakSave}
          onToggleAchievementBoost={(boost) => setPowerUps((current) => ({ ...current, achievementBoost: boost }))}
        />
        <KeyboardShortcutsModal
          isOpen={isKeyboardShortcutsOpen}
          onClose={() => setIsKeyboardShortcutsOpen(false)}
        />
        <ImageEditor
          file={editingFile}
          initialMode={editingSession?.focusMode || 'rotate'}
          onClose={handleCloseEditor}
          onSave={handleSaveEditor}
        />
      </div>

      <main className="app-card app-card--split app-card--with-menu" data-reveal>
        <section className="hero hero--split" data-parallax>
          <div>
            <p className="eyebrow">Image converter</p>
            <h1>Image Format Converter</h1>
            <p className="hero-copy">
              Drag files into the upload zone, choose a target format, then convert and download the finished results.
            </p>
            <div className="hero-stats" aria-label="Conversion streak and achievements">
              <span className="pill">🔥 {achievementsState.streakDays}-day streak</span>
              <span className="pill">🏆 {unlockedAchievementsCount} achievements</span>
              <span className="pill">⚡ {achievementsState.totalConverted} total conversions</span>
            </div>
          </div>

          <button
            type="button"
            className="achievement-summary-card"
            onClick={() => setAchievementGalleryOpen((current) => !current)}
            aria-expanded={achievementGalleryOpen}
            aria-controls="achievement-gallery"
          >
            <div className="achievement-summary-card__topline">
              <span className="achievement-summary-card__label">Achievement vault</span>
              <span className="achievement-summary-card__count">{unlockedAchievementsCount}/8 unlocked</span>
            </div>
            <strong>Distinct badges, real progress, on-device memory.</strong>
            <span className="achievement-summary-card__meta">
              {achievementsState.streakDays}-day streak · {Object.keys(achievementsState.formatCounts || {}).length} formats explored · {achievementsState.sessionConverted} this session
            </span>
          </button>
        </section>

        <ProgressBar value={progress} visible={isConverting || paused || progress === 100} />
        {errorMessage ? <p className="helper-text helper-text--error">{errorMessage}</p> : null}

        <div className="split-layout split-layout--bottom-rail">
          <section className="split-layout__column split-layout__column--input" data-reveal>
            <UploadZone
              onFilesAdded={addFiles}
              disabled={false}
              targetFormat={targetFormat}
              files={files}
              convertedFiles={convertedFiles}
              converting={isConverting}
              convertingMap={convertingMap}
              convertingProgress={convertingProgress}
              onRemove={handleRemoveFile}
              onCancel={handleCancelItem}
              onReorder={handleReorder}
              onRotationChange={handleRotationChange}
              onCropChange={handleCropChange}
              onOpenEditor={handleOpenEditor}
              paused={paused}
              queueSummary={queueSummary}
            />
          </section>

          <section className="split-layout__column split-layout__column--output" data-reveal>
            <ConvertedZone
              convertedFiles={convertedFiles}
              canDownloadZip={canDownloadZip}
              isDownloadingZip={isDownloadingZip}
              onDownloadZip={handleDownloadZip}
              onDownloadAll={handleDownloadAll}
              onClearConverted={handleClearConverted}
              targetFormat={targetFormat}
              activeTransfers={activeTransfers}
            />
          </section>

          {activeTransfers.length ? (
            <div className="swipe-overlay" aria-hidden="true">
              {activeTransfers.map((item) => (
                <article
                  key={item.id}
                  className="image-card image-card--swiping swipe-overlay__card"
                  style={{ '--swipe-stack-index': item.stackIndex }}
                >
                  <div className="image-card__preview swipe-overlay__preview">
                    <SwipePreview file={item.file} />
                  </div>
                  <div className="image-card__content image-card__content--minimal swipe-overlay__meta">
                    <strong title={item.file.name}>{item.file.name}</strong>
                    <span>{item.label}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <aside className="split-layout__rail split-layout__rail--bottom" aria-label="Conversion controls" data-reveal>
            <div className="panel panel--compact action-panel action-panel--split action-panel--rail">
              <div className="action-panel__top">
                <div className="action-panel__intro">
                  <p className="helper-text helper-text--subtle">Flip images from the upload lane into the converted lane.</p>
                </div>
                <div className="action-panel__format-selector">
                  <FormatSelector value={targetFormat} onChange={setTargetFormat} disabled={isConverting} />
                </div>
              </div>

              {formatValidation.hasConflict ? (
                <div className="helper-callout helper-callout--warning" role="status" aria-live="polite">
                  <strong>⚠ Format check</strong>
                  <p>{formatValidation.message}</p>
                </div>
              ) : null}

              <QueuePanel
                paused={paused}
                converting={isConverting}
                queueSummary={queueSummary}
                onPause={handlePause}
                onResume={handleResume}
              />

              <div className="action-panel__bottom">
                <div className="flow-arrow" aria-hidden="true">
                  <span>Upload</span>
                  <div className="flow-arrow__line" />
                  <span>Results</span>
                </div>

                <div className="action-panel__controls">
                  <ConvertButton onClick={handleConvert} disabled={!canConvert} converting={isConverting} pendingCount={formatValidation.convertibleFiles.length} />

                  <button className="secondary-button secondary-button--danger secondary-button--full-on-mobile" onClick={handleClearAll} disabled={!canClearAll}>
                    Clear all
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <XpProgress
          xpState={xpState}
          reducedMotion={reducedMotion === null ? systemPrefersReducedMotion : reducedMotion}
        />

        <section
          id="achievement-gallery"
          className={`achievement-gallery panel ${achievementGalleryOpen ? 'achievement-gallery--open' : 'achievement-gallery--closed'}`}
          data-reveal
          aria-label="Achievement gallery"
        >
          <div className="section-heading achievement-gallery__heading">
            <div>
              <p className="eyebrow achievement-gallery__eyebrow">Achievement system</p>
              <h3>Conversion relics</h3>
              <p className="section-copy">Each badge has its own visual language, explicit unlock criteria, and live progress.</p>
            </div>
            <div className="achievement-gallery__actions">
              <span className="pill">{ACHIEVEMENT_SYSTEM_DEFINITIONS.length} total badges</span>
              <button type="button" className="secondary-button secondary-button--small" onClick={handleDismissAchievementGallery}>Hide gallery</button>
            </div>
          </div>

          <div className="achievement-grid">
            {achievements.map((achievement) => (
              <article key={achievement.id} className={`achievement-card achievement-card--${achievement.theme} ${achievement.unlocked ? 'achievement-card--unlocked' : 'achievement-card--locked'}`}>
                <div className="achievement-card__header">
                  <div className="achievement-card__sigil" aria-hidden="true">{achievement.icon}</div>
                  <span className="achievement-card__status">{achievement.unlocked ? 'Unlocked' : 'Locked'}</span>
                </div>
                <div className="achievement-card__body">
                  <div>
                    <p className="achievement-card__kicker">{achievement.metric.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <h4>{achievement.name}</h4>
                    <p>{achievement.criteria}</p>
                  </div>
                  <div className="achievement-card__meter">
                    <div className="achievement-card__meter-track" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, (achievement.progress / achievement.target) * 100)}%` }} />
                    </div>
                    <div className="achievement-card__meter-meta">
                      <strong>{achievement.progressLabel}</strong>
                      <span>{achievement.progressValue} tracked</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <DailyGoalPanel
          goal={dailyGoal}
          count={dailyGoalState.count}
          streak={dailyGoalState.streak}
          percent={dailyGoalProgress}
          completedToday={dailyGoalState.completedToday}
          milestone={dailyGoalMilestone}
          celebrationKey={dailyGoalCelebrationKey}
          reducedMotion={resolvedReducedMotion}
          onGoalChange={(value) => setDailyGoal(clampDailyGoal(value))}
        />
      </main>
    </div>
  );
}
