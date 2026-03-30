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
    if (file?.downloadUrl) {
      setSrc(file.downloadUrl);
      return undefined;
    }

    if (!file?.blobBase64) return undefined;

    const mimeType = file.mimeType || 'image/png';
    const byteString = atob(file.blobBase64);
    const bytes = new Uint8Array(byteString.length);
    for (let index = 0; index < byteString.length; index += 1) {
      bytes[index] = byteString.charCodeAt(index);
    }

    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!src) {
    return <span>{(file?.convertedName || 'OK').slice(0, 2).toUpperCase()}</span>;
  }

  return <img src={src} alt={file?.convertedName || 'Converted image'} />;
}

export default function ConvertedImageList({ convertedFiles }) {
  if (!convertedFiles.length) {
    return <p className="empty-state">Converted images will appear here after the conversion finishes.</p>;
  }

  return (
    <div className="image-grid image-grid--output">
      {convertedFiles.map((file) => (
        <article className="image-card image-card--converted image-card--arrived image-card--preview-only" key={file.id}>
          <div className="image-card__preview image-card__preview--success">
            <Preview file={file} />
          </div>
          <div className="image-card__content image-card__content--minimal">
            <div>
              <h4 title={file.convertedName}>{file.convertedName}</h4>
              <p>{formatBytes(file.size)}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
