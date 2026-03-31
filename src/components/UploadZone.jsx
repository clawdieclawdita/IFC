import { useEffect, useMemo, useRef, useState } from 'react';
import ImageList from './ImageList';

const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/tiff',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp', '.gif', '.svg'];
const EXTENSION_ALIASES = {
  jpeg: 'jpg',
  tif: 'tiff',
};

const isValidFile = (file) => {
  if (!file) return false;
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;

  const name = file.name?.toLowerCase() || '';
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
};

const getFileExtension = (file) => {
  const extension = file?.name?.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_ALIASES[extension] || extension;
};

const formatRejectedFilesMessage = (rejectedFiles, targetFormat) => {
  if (!rejectedFiles.length || !targetFormat) return '';

  const upperTargetFormat = targetFormat.toUpperCase();
  const fileLabel = rejectedFiles.length > 1 ? 'files' : 'file';
  const fileNames = rejectedFiles.map((file) => file.name).join(', ');

  return `Cannot upload ${upperTargetFormat} ${fileLabel} when ${upperTargetFormat} is selected as target format. Rejected: ${fileNames}.`;
};

export default function UploadZone({
  onFilesAdded,
  disabled,
  targetFormat,
  files,
  convertedFiles,
  converting,
  convertingMap,
  convertingProgress,
  onRemove,
  onCancel,
  onReorder,
  onRotationChange,
  onCropChange,
  onOpenEditor,
  paused,
  queueSummary,
}) {
  const inputRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const accept = useMemo(() => ACCEPTED_EXTENSIONS.join(','), []);

  useEffect(() => () => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
  }, []);

  const showError = (message) => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    setLocalError(message);

    if (message) {
      errorTimeoutRef.current = window.setTimeout(() => {
        setLocalError('');
        errorTimeoutRef.current = null;
      }, 5000);
    }
  };

  const processFiles = (incomingFiles) => {
    const filesToProcess = Array.from(incomingFiles || []).map((file) => {
      const relativePath = file.webkitRelativePath || file.relativePath || '';
      if (!relativePath) return file;
      return Object.assign(file, { relativePath });
    });
    if (!filesToProcess.length) return;

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }

    const validFiles = filesToProcess.filter(isValidFile);
    const invalidCount = filesToProcess.length - validFiles.length;
    const rejectedByFormat = targetFormat
      ? validFiles.filter((file) => getFileExtension(file) === targetFormat.toLowerCase())
      : [];
    const acceptedFiles = validFiles.filter((file) => !rejectedByFormat.includes(file));

    if (!acceptedFiles.length) {
      if (rejectedByFormat.length) {
        showError(formatRejectedFilesMessage(rejectedByFormat, targetFormat));
        return;
      }

      showError('Please upload supported image files only.');
      return;
    }

    if (rejectedByFormat.length) {
      showError(formatRejectedFilesMessage(rejectedByFormat, targetFormat));
    } else if (invalidCount > 0) {
      showError(`${invalidCount} file${invalidCount > 1 ? 's were' : ' was'} skipped because the format is not supported.`);
    } else {
      setLocalError('');
    }

    onFilesAdded(acceptedFiles);
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <section className="panel panel--zone panel--zone-input upload-panel">
      <div className="section-heading section-heading--zone upload-panel__heading">
        <div>
          <h3>Drop your images here</h3>
          <p className="section-copy">Add files, reorder the queue, and review progress in the same panel.</p>
        </div>
        <div className="upload-panel__meta">
          {paused ? <span className="pill pill--warning">Paused</span> : null}
          <span className="pill">{queueSummary?.total ?? files.length} total</span>
        </div>
      </div>

      <div
        className={`upload-zone ${isDragging ? 'upload-zone--active' : ''} ${disabled ? 'upload-zone--disabled' : ''}`}
        onClick={openPicker}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          processFiles(event.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
      >
        <div className="upload-zone__icon">⬆</div>
        <h2>Drop your images here</h2>
        <p>Drag and drop JPG, PNG, BMP, TIFF, WEBP, GIF, or SVG files.</p>
        <button
          type="button"
          className="secondary-button"
          onClick={(event) => {
            event.stopPropagation();
            openPicker();
          }}
          disabled={disabled}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={(event) => {
            processFiles(event.target.files);
            event.target.value = '';
          }}
          disabled={disabled}
        />
      </div>

      {queueSummary ? (
        <div className="queue-inline-status" role="status" aria-live="polite">
          <span>{queueSummary.converted} of {queueSummary.total} converted</span>
          <span>{queueSummary.pending} pending</span>
          {queueSummary.processing ? <span>{queueSummary.processing} processing</span> : null}
        </div>
      ) : null}

      {localError ? <p className="helper-text helper-text--warning" role="alert">{localError}</p> : null}

      <ImageList
        files={files}
        convertedFiles={convertedFiles}
        converting={converting}
        convertingMap={convertingMap}
        convertingProgress={convertingProgress}
        targetFormat={targetFormat}
        onRemove={onRemove}
        onCancel={onCancel}
        onReorder={onReorder}
        onRotationChange={onRotationChange}
        onCropChange={onCropChange}
        onOpenEditor={onOpenEditor}
        paused={paused}
        compact
      />
    </section>
  );
}
