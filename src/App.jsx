import { useEffect, useMemo, useState } from 'react';
import ConvertButton from './components/ConvertButton';
import ConvertedZone from './components/ConvertedZone';
import FormatSelector from './components/FormatSelector';
import { MenuBar } from './components/MenuBar';
import ProgressBar from './components/ProgressBar';
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
  menuExpanded: 'image-converter.menuExpanded',
  activePanel: 'image-converter.activePanel',
  quality: 'image-converter.quality',
  width: 'image-converter.width',
  height: 'image-converter.height',
  keepAspectRatio: 'image-converter.keepAspectRatio',
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

export default function App() {
  const [files, setFiles] = useState([]);
  const [targetFormat, setTargetFormat] = useState('png');
  const [convertedFiles, setConvertedFiles] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertingMap, setConvertingMap] = useState({});
  const [convertingProgress, setConvertingProgress] = useState({});
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [isMenuExpanded, setIsMenuExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;

    const storedValue = window.localStorage.getItem(STORAGE_KEYS.menuExpanded);
    if (storedValue !== null) {
      return JSON.parse(storedValue);
    }

    return true;
  });
  const [activePanel, setActivePanel] = useState(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEYS.activePanel) || null;
  });
  const [quality, setQuality] = useState(() => parseNumberStorage(STORAGE_KEYS.quality) ?? QUALITY_DEFAULT);
  const [resizeWidth, setResizeWidth] = useState(() => parseNumberStorage(STORAGE_KEYS.width));
  const [resizeHeight, setResizeHeight] = useState(() => parseNumberStorage(STORAGE_KEYS.height));
  const [keepAspectRatio, setKeepAspectRatio] = useState(() => parseBooleanStorage(STORAGE_KEYS.keepAspectRatio, true));
  const [imageMetrics, setImageMetrics] = useState({ originalSize: 0, originalWidth: 0, originalHeight: 0 });

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

  const canConvert = useMemo(
    () => formatValidation.convertibleFiles.length > 0 && !isConverting,
    [formatValidation.convertibleFiles.length, isConverting],
  );
  const canDownloadZip = useMemo(() => convertedFiles.length > 0 && !isDownloadingZip, [convertedFiles.length, isDownloadingZip]);
  const canClearAll = useMemo(() => files.length > 0 && !isConverting, [files.length, isConverting]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.menuExpanded, JSON.stringify(isMenuExpanded));
  }, [isMenuExpanded]);

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
    originalSize: imageMetrics.originalSize,
    originalWidth: imageMetrics.originalWidth,
    originalHeight: imageMetrics.originalHeight,
    maxAllowedWidth: imageMetrics.originalWidth,
    maxAllowedHeight: imageMetrics.originalHeight,
    estimatedSizeBytes,
    estimatedSizeLabel: formatBytes(estimatedSizeBytes),
    qualityAppliesToTarget: QUALITY_FORMATS.has(targetFormat),
    targetFormat,
  }), [estimatedSizeBytes, imageMetrics.originalHeight, imageMetrics.originalSize, imageMetrics.originalWidth, keepAspectRatio, quality, resizeHeight, resizeWidth, targetFormat]);

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
    setConvertedFiles([]);
    setConvertingMap({});
    setConvertingProgress({});
    setActiveTransfers([]);
    setProgress(0);

    const enrichedIncomingFiles = await Promise.all(incomingFiles.map(async (file) => Object.assign(file, await readImageDimensions(file))));

    setFiles((current) => {
      const deduped = new Map(current.map((file) => [getFileKey(file), file]));
      enrichedIncomingFiles.forEach((file) => {
        deduped.set(getFileKey(file), file);
      });
      return Array.from(deduped.values());
    });
  };

  const handleRemoveFile = (fileToRemove) => {
    const fileKey = getFileKey(fileToRemove);
    if (convertingMap[fileKey]?.phase === 'swiping' || convertingMap[fileKey]?.phase === 'transitioning') {
      return;
    }

    setErrorMessage('');
    setFiles((current) => current.filter((file) => getFileKey(file) !== fileKey));
    setConvertedFiles((current) => current.filter((item) => item.originalName !== fileToRemove.name));
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
    setProgress(0);
  };

  const handleClearAll = () => {
    if (!canClearAll) return;

    const confirmed = window.confirm('Clear all uploaded and converted images? This cannot be undone.');
    if (!confirmed) return;

    setErrorMessage('');
    setFiles([]);
    setConvertedFiles([]);
    setConvertingMap({});
    setConvertingProgress({});
    setActiveTransfers([]);
    setProgress(0);
  };

  const handleClearConverted = () => {
    setConvertedFiles([]);
    setErrorMessage('');
    setProgress(0);
  };

  const handleToggleMenu = () => {
    setIsMenuExpanded((current) => {
      const next = !current;
      if (!next) {
        setActivePanel(null);
      }
      return next;
    });
  };

  const handleSelectPanel = (panelId) => {
    setIsMenuExpanded(true);
    setActivePanel((current) => (current === panelId ? null : panelId));
  };

  const handleClosePanel = () => {
    setActivePanel(null);
  };

  const handleConvert = async () => {
    if (isConverting) return;

    if (!files.length) {
      setErrorMessage('Upload at least one image before converting.');
      return;
    }

    if (!formatValidation.convertibleFiles.length) {
      setErrorMessage(`All uploaded files are already ${targetFormat.toUpperCase()}. Choose a different format to convert them.`);
      return;
    }

    setIsConverting(true);
    setErrorMessage('');
    setConvertedFiles([]);
    setProgress(4);
    setConvertingMap({});
    setConvertingProgress({});
    setActiveTransfers([]);

    const queue = formatValidation.convertibleFiles;
    const queuedKeys = new Set(queue.map((file) => getFileKey(file)));
    const transferItems = queue.map((file, index) => ({
      id: getFileKey(file),
      label: `${getFileExtension(file).toUpperCase()}→${targetFormat.toUpperCase()}`,
      file,
      stackIndex: index % MAX_VISIBLE_SWIPE_STACK,
    }));

    setConvertingMap(
      Object.fromEntries(queue.map((file) => [getFileKey(file), { phase: 'swiping' }])),
    );
    setConvertingProgress(Object.fromEntries(queue.map((file) => [getFileKey(file), 18])));
    setActiveTransfers(transferItems);
    setFiles((current) => current.filter((item) => !queuedKeys.has(getFileKey(item))));

    try {
      await wait(SWIPE_DURATION_MS);

      let completedCount = 0;

      const results = await Promise.allSettled(
        queue.map(async (file) => {
          const fileKey = getFileKey(file);

          setConvertingMap((current) => ({ ...current, [fileKey]: { phase: 'transitioning' } }));
          setConvertingProgress((current) => ({ ...current, [fileKey]: 62 }));

          const converted = await convertSingle({
            file,
            targetFormat,
            quality,
            width: resizeWidth != null ? clampDimension(resizeWidth, file.originalWidth || imageMetrics.originalWidth || 4000) : null,
            height: resizeHeight != null ? clampDimension(resizeHeight, file.originalHeight || imageMetrics.originalHeight || 4000) : null,
            keepAspectRatio,
          });

          setConvertingMap((current) => ({ ...current, [fileKey]: { phase: 'arrived' } }));
          setConvertedFiles((current) => [...current, converted]);
          setConvertingProgress((current) => ({ ...current, [fileKey]: 100 }));
          setActiveTransfers((current) => current.filter((item) => item.id !== fileKey));

          completedCount += 1;
          setProgress(Math.round((completedCount / queue.length) * 100));
          await wait(ARRIVAL_DURATION_MS);

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

          return converted;
        }),
      );

      const failedResults = results.filter((result) => result.status === 'rejected');

      if (failedResults.length) {
        const failedFiles = queue.filter((_, index) => results[index].status === 'rejected');

        setFiles((current) => [...failedFiles, ...current]);
        setActiveTransfers((current) => current.filter((item) => !failedFiles.some((file) => getFileKey(file) === item.id)));
        setConvertingMap((current) => {
          const next = { ...current };
          failedFiles.forEach((file) => {
            delete next[getFileKey(file)];
          });
          return next;
        });
        setConvertingProgress((current) => {
          const next = { ...current };
          failedFiles.forEach((file) => {
            delete next[getFileKey(file)];
          });
          return next;
        });

        const firstFailure = failedResults[0].reason;
        const failureMessage = firstFailure?.message || 'Conversion failed.';
        setErrorMessage(
          failedResults.length === queue.length
            ? failureMessage
            : `${failedResults.length} of ${queue.length} conversions failed. ${failureMessage}`,
        );

        if (completedCount === 0) {
          setProgress(0);
        }
      }
    } finally {
      setIsConverting(false);
    }
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
      const blob = await createZip({ targetFormat, convertedFiles });
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

      <div className="app-top-chrome">
        <MenuBar
          isExpanded={isMenuExpanded}
          activePanel={activePanel}
          onToggleExpanded={handleToggleMenu}
          onSelectPanel={handleSelectPanel}
        />
        <SettingsPanel
          activePanel={activePanel}
          onClose={handleClosePanel}
          settings={settingsState}
          onChange={handleSettingsChange}
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

        <ProgressBar value={progress} visible={isConverting || progress === 100} />
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
