import ConvertedImageList from './ConvertedImageList';

export default function ConvertedZone({
  convertedFiles,
  canDownloadZip,
  isDownloadingZip,
  onDownloadZip,
  onDownloadAll,
  onClearConverted,
  targetFormat,
  activeTransfers = [],
}) {
  return (
    <section className="panel panel--zone panel--zone-output converted-zone">
      <div className="section-heading section-heading--zone">
        <div>
          <h3>Converted images</h3>
          <p className="section-copy">Finished files land on the right and can be downloaded together as separate files or as a ZIP.</p>
        </div>
        <span className="pill pill--success">{convertedFiles.length} ready</span>
      </div>

      <div className="conversion-lane" aria-hidden="true">
        <span>Input</span>
        <div className="conversion-lane__track">
          <div className="conversion-lane__arrow" />
          {activeTransfers.map((item) => (
            <div key={item.id} className="conversion-lane__token">
              {item.label}
            </div>
          ))}
        </div>
        <span>{targetFormat.toUpperCase()}</span>
      </div>

      <div className="converted-zone__actions">
        <button className="secondary-button" onClick={onDownloadAll} disabled={!convertedFiles.length || isDownloadingZip}>
          Download All
        </button>
        <button className="secondary-button" onClick={onDownloadZip} disabled={!canDownloadZip}>
          {isDownloadingZip ? 'Preparing ZIP…' : 'Download all as ZIP'}
        </button>
        <button className="secondary-button secondary-button--danger" onClick={onClearConverted} disabled={!convertedFiles.length}>
          Clear converted
        </button>
      </div>

      <ConvertedImageList convertedFiles={convertedFiles} />
    </section>
  );
}
