const FORMATS = ['png', 'jpg', 'bmp', 'tiff', 'webp', 'gif', 'svg'];

export default function FormatSelector({ value, onChange, disabled }) {
  return (
    <div className="format-grid">
      {FORMATS.map((format) => (
        <label key={format} className={`format-option ${value === format ? 'format-option--active' : ''}`}>
          <input
            type="radio"
            name="target-format"
            value={format}
            checked={value === format}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
          />
          <span>{format.toUpperCase()}</span>
        </label>
      ))}
    </div>
  );
}
