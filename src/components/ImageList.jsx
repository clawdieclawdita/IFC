import { useEffect, useState } from 'react';

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const getFileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;

function Preview({ file }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!file?.type?.startsWith('image/')) return undefined;

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!file?.type?.startsWith('image/')) {
    return <span>{file.name.slice(0, 2).toUpperCase()}</span>;
  }

  const crop = file.crop || { top: 0, right: 0, bottom: 0, left: 0 };

  return (
    <div className="image-preview-stack">
      <img
        src={src}
        alt={file.name}
        style={{
          transform: `rotate(${Number(file.rotation) || 0}deg)`,
        }}
      />
      {(crop.top || crop.right || crop.bottom || crop.left) ? (
        <div className="crop-overlay" aria-hidden="true">
          <div className="crop-overlay__frame" style={{ inset: `${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export default function ImageList({
  files,
  convertedFiles,
  converting,
  convertingMap,
  convertingProgress,
  targetFormat,
  onRemove,
  onCancel,
  onReorder,
  onOpenEditor,
  compact = false,
  paused = false,
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  if (!files.length) {
    return (
      <div className={`queue-block ${compact ? 'queue-block--compact' : ''}`}>
        <div className="section-heading section-heading--zone">
          <div>
            <h3>No images uploaded yet</h3>
            <p className="section-copy">Your uploaded files will appear here with live conversion status.</p>
          </div>
        </div>
        <p className="empty-state">Drag files into the upload area to populate the queue.</p>
      </div>
    );
  }

  const handleDragStart = (event, index) => {
    setDraggedIndex(index);
    setDragOverIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (event, index) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (event, toIndex) => {
    event.preventDefault();
    event.stopPropagation();
    const dataTransferIndex = Number.parseInt(event.dataTransfer.getData('text/plain'), 10);
    const fromIndex = Number.isInteger(dataTransferIndex) ? dataTransferIndex : draggedIndex;
    if (Number.isInteger(fromIndex) && fromIndex !== toIndex) {
      onReorder?.(fromIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className={`queue-block ${compact ? 'queue-block--compact' : ''}`}>
      <div className="section-heading section-heading--zone">
        <div>
          <h3>{files.length} image{files.length > 1 ? 's' : ''} loaded</h3>
          <p className="section-copy">Drag cards to reorder the queue. Use the crop or rotation icons to edit each image.</p>
        </div>
        <span className="pill">{files.length} pending</span>
      </div>

      <div className="image-grid" data-testid="queue-grid">
        {files.map((file, index) => {
          const converted = convertedFiles.find((item) => item.originalName === file.name);
          const fileKey = getFileKey(file);
          const phase = convertingMap[fileKey]?.phase || (converted ? 'converted' : 'idle');
          const progressValue = convertingProgress[fileKey] ?? 0;
          const isAnimating = phase === 'swiping' || phase === 'transitioning';
          const isProcessing = isAnimating || phase === 'arrived';
          const status = phase === 'swiping'
            ? 'Swiping to output'
            : phase === 'transitioning'
              ? 'Converting'
              : converted
                ? 'Converted'
                : paused
                  ? 'Paused'
                  : converting && index === 0
                    ? 'Queued'
                    : 'Waiting';

          return (
            <article
              className={`image-card image-card--${phase} ${converted ? 'image-card--converted' : ''} ${draggedIndex === index ? 'image-card--dragging' : ''} ${dragOverIndex === index && draggedIndex !== null && draggedIndex !== index ? 'image-card--drag-over' : ''}`}
              key={fileKey}
              draggable={!isProcessing}
              onDragStart={(event) => handleDragStart(event, index)}
              onDragOver={(event) => handleDragOver(event, index)}
              onDragOverCapture={(event) => handleDragOver(event, index)}
              onDrop={(event) => handleDrop(event, index)}
              onDropCapture={(event) => handleDrop(event, index)}
              onDragEnd={handleDragEnd}
              data-queue-index={index}
              data-file-name={file.name}
            >
              <div className="image-card__controls">
                <button
                  type="button"
                  className="image-card__cancel"
                  onClick={() => onCancel?.(file)}
                  aria-label={`Cancel ${file.name}`}
                  title="Cancel this item"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="image-card__icon-button"
                  onClick={() => onOpenEditor?.(file, 'rotate')}
                  disabled={isProcessing}
                  aria-label={`Open rotation editor for ${file.name}`}
                  title="Rotate image"
                >
                  ↻
                </button>
                <button
                  type="button"
                  className="image-card__icon-button"
                  onClick={() => onOpenEditor?.(file, 'crop')}
                  disabled={isProcessing}
                  aria-label={`Open crop editor for ${file.name}`}
                  title="Crop image"
                >
                  ✂️
                </button>
                <button
                  type="button"
                  className="image-card__remove"
                  onClick={() => onRemove(file)}
                  disabled={isProcessing}
                  aria-label={isProcessing ? `Remove disabled while ${file.name} is converting` : `Remove ${file.name}`}
                  title={isProcessing ? 'Wait until this image finishes its animation.' : 'Remove image from queue'}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>

              <div className="image-card__preview-wrap">
                <div className="image-card__preview image-card__preview--3d">
                  <Preview file={file} />
                </div>
                {phase === 'swiping' || phase === 'transitioning' ? (
                  <div className="image-card__format-change" aria-live="polite">
                    {file.name.split('.').pop()?.toUpperCase() || 'IMG'} → {targetFormat.toUpperCase()}
                  </div>
                ) : null}
                {phase === 'swiping' || phase === 'transitioning' ? <div className="image-card__trail" aria-hidden="true" /> : null}
              </div>

              <div className="image-card__content">
                <div>
                  <h4 title={file.name}>{file.name}</h4>
                  <p>{formatBytes(file.size)}</p>
                </div>
                <span className={`status-badge ${converted ? 'status-badge--success' : isAnimating ? 'status-badge--loading' : paused ? 'status-badge--paused' : ''}`}>
                  {status}
                </span>
                {phase === 'swiping' || phase === 'transitioning' ? (
                  <div className="mini-progress" aria-hidden="true">
                    <div className="mini-progress__fill" style={{ width: `${progressValue}%` }} />
                  </div>
                ) : null}
                {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index ? (
                  <div className="queue-drop-indicator" aria-hidden="true">Drop here</div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
