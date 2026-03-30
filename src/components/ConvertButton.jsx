export default function ConvertButton({ disabled, converting, onClick, pendingCount }) {
  return (
    <button className="primary-button convert-button" onClick={onClick} disabled={disabled}>
      <span className="convert-button__icon" aria-hidden="true">⇢</span>
      <span>
        {converting ? 'Converting images…' : 'Convert images'}
        <small>{pendingCount > 0 ? `${pendingCount} ready for conversion` : 'Upload images to begin'}</small>
      </span>
    </button>
  );
}
