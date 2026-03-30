import { useEffect, useState } from 'react';

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

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

  return <img src={src} alt={file.name} />;
}

export default function ImageList({
  files,
  convertedFiles,
  converting,
  convertingMap,
  convertingProgress,
  targetFormat,
  onRemove,
  compact = false,
}) {
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

  return (
    <div className={`queue-block ${compact ? 'queue-block--compact' : ''}`}>
      <div className="section-heading section-heading--zone">
        <div>
          <h3>{files.length} image{files.length > 1 ? 's' : ''} loaded</h3>
          <p className="section-copy">Queued files remain interactive until their conversion animation begins.</p>
        </div>
        <span className="pill">{files.length} pending</span>
      </div>

      <div className="image-grid">
        {files.map((file, index) => {
          const converted = convertedFiles.find((item) => item.originalName === file.name);
          const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
          const phase = convertingMap[fileKey]?.phase || (converted ? 'converted' : 'idle');
          const progressValue = convertingProgress[fileKey] ?? 0;
          const isAnimating = phase === 'swiping' || phase === 'transitioning';
          const status = phase === 'swiping'
            ? 'Swiping to output'
            : phase === 'transitioning'
              ? 'Converting'
              : converted
                ? 'Converted'
                : converting && index === 0
                  ? 'Queued'
                  : 'Waiting';

          return (
            <article
              className={`image-card image-card--${phase} ${converted ? 'image-card--converted' : ''}`}
              key={fileKey}
            >
              <button
                type="button"
                className="image-card__remove"
                onClick={() => onRemove(file)}
                disabled={isAnimating}
                aria-label={isAnimating ? `Remove disabled while ${file.name} is converting` : `Remove ${file.name}`}
                title={isAnimating ? 'Wait until this image finishes its animation.' : 'Remove image from queue'}
              >
                <span aria-hidden="true">✕</span>
              </button>

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
                <span className={`status-badge ${converted ? 'status-badge--success' : isAnimating ? 'status-badge--loading' : ''}`}>
                  {status}
                </span>
                {phase === 'swiping' || phase === 'transitioning' ? (
                  <div className="mini-progress" aria-hidden="true">
                    <div className="mini-progress__fill" style={{ width: `${progressValue}%` }} />
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
