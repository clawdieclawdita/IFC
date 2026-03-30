import { useEffect, useMemo, useRef, useState } from 'react';
import ConvertButton from './components/ConvertButton';
import ConvertedZone from './components/ConvertedZone';
import FormatSelector from './components/FormatSelector';
import { MenuBar } from './components/MenuBar';
import { OfflineBadge } from './components/OfflineBadge';
import ProgressBar from './components/ProgressBar';
import QueuePanel from './components/QueuePanel';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { SettingsPanel } from './components/SettingsPanel';
import UploadZone from './components/UploadZone';
import { convertSingle, createZip, triggerDownload } from './lib/api';

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
  queue: 'image-converter.queue',
};

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

  const keysToRemove = Object.values(STORAGE_KEYS);
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
  });
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

export default function App() {
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
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false));
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false));
  const [imageMetrics, setImageMetrics] = useState({ originalSize: 0, originalWidth: 0, originalHeight: 0 });

  const pausedRef = useRef(paused);
  const abortControllersRef = useRef({});
  const currentRunIdRef = useRef(0);
  const filesRef = useRef(files);
  const convertedFilesRef = useRef(convertedFiles);
  const processingRef = useRef(processing);

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

  const canConvert = useMemo(
    () => formatValidation.convertibleFiles.length > 0 && !isConverting && !paused,
    [formatValidation.convertibleFiles.length, isConverting, paused],
  );
  const canDownloadZip = useMemo(() => convertedFiles.length > 0 && !isDownloadingZip, [convertedFiles.length, isDownloadingZip]);
  const canClearAll = useMemo(() => (files.length > 0 || convertedFiles.length > 0) && !isConverting, [convertedFiles.length, files.length, isConverting]);

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
    if (typeof window === 'undefined') return undefined;

    const isEditableTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    };

    const panelShortcuts = ['settings', 'quality', 'size', 'queue', 'privacy', 'filename', 'progress', 'advanced'];

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
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

      if (editableTarget) return;

      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setIsKeyboardShortcutsOpen(true);
        return;
      }

      if (/^[1-8]$/.test(event.key)) {
        event.preventDefault();
        const panelId = panelShortcuts[Number(event.key) - 1];
        setActivePanel((current) => (current === panelId ? null : panelId));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, isKeyboardShortcutsOpen]);

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
    resolvedDarkMode: darkMode === null ? systemPrefersDark : darkMode,
    resolvedReducedMotion: reducedMotion === null ? systemPrefersReducedMotion : reducedMotion,
  }), [autoClearOnExit, customFilenamePattern, darkMode, estimatedSizeBytes, filenameConvention, imageMetrics.originalHeight, imageMetrics.originalSize, imageMetrics.originalWidth, keepAspectRatio, preserveFolderStructure, preserveMetadata, quality, reducedMotion, resizeHeight, resizeWidth, stripMetadata, systemPrefersDark, systemPrefersReducedMotion, targetFormat]);

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
        deduped.set(getFileKey(file), file);
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

  const processQueue = async (runId) => {
    const totalAtStart = filesRef.current.length + convertedFilesRef.current.length;
    let completedCount = convertedFilesRef.current.length;

    while (!pausedRef.current) {
      const nextFile = filesRef.current.find((file) => getFileExtension(file) !== targetFormat);
      if (!nextFile) break;

      const fileKey = getFileKey(nextFile);
      const stackIndex = processingRef.current.length % MAX_VISIBLE_SWIPE_STACK;
      const controller = new AbortController();
      abortControllersRef.current[fileKey] = controller;

      setProcessing((current) => [...current, fileKey]);
      setConvertingMap((current) => ({ ...current, [fileKey]: { phase: 'swiping' } }));
      setConvertingProgress((current) => ({ ...current, [fileKey]: 18 }));
      setActiveTransfers((current) => [...current, {
        id: fileKey,
        label: `${getFileExtension(nextFile).toUpperCase()}→${targetFormat.toUpperCase()}`,
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

        const converted = await convertSingle({
          file: nextFile,
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
        setProgress(totalAtStart ? Math.round((completedCount / totalAtStart) * 100) : 0);
        await wait(ARRIVAL_DURATION_MS);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setErrorMessage(error.message || 'Conversion failed.');
        }
      } finally {
        clearProcessingStateForKey(fileKey);
      }
    }

    if (currentRunIdRef.current === runId) {
      setIsConverting(false);
      setProcessing([]);
      setActiveTransfers([]);
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
    <div className="app-shell">
      <div className="background-orb background-orb--left" />
      <div className="background-orb background-orb--right" />
      <div className="top-right-controls" aria-label="Status and theme controls">
        <OfflineBadge />
        <DarkModeToggle
          darkMode={darkMode}
          resolvedDarkMode={darkMode === null ? systemPrefersDark : darkMode}
          onChange={handleSettingsChange}
        />
      </div>

      <div className="app-top-chrome">
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
        />
        <KeyboardShortcutsModal
          isOpen={isKeyboardShortcutsOpen}
          onClose={() => setIsKeyboardShortcutsOpen(false)}
        />
      </div>

      <main className="app-card app-card--split app-card--with-menu">
        <section className="hero hero--split">
          <div>
            <p className="eyebrow">Image converter</p>
            <h1>Image Format Converter</h1>
            <p className="hero-copy">
              Drag files into the upload zone, choose a target format, then convert and download the finished results.
            </p>
          </div>
        </section>

        <ProgressBar value={progress} visible={isConverting || paused || progress === 100} />
        {errorMessage ? <p className="helper-text helper-text--error">{errorMessage}</p> : null}

        <div className="split-layout split-layout--bottom-rail">
          <section className="split-layout__column split-layout__column--input">
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
              paused={paused}
              queueSummary={queueSummary}
            />
          </section>

          <section className="split-layout__column split-layout__column--output">
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

          <aside className="split-layout__rail split-layout__rail--bottom" aria-label="Conversion controls">
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
      </main>
    </div>
  );
}
