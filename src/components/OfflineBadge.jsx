export function OfflineBadge() {
  return (
    <div className="offline-badge" aria-label="App is running locally">
      <span aria-hidden="true">🔒</span>
      <span className="offline-badge__text">LOCAL</span>
    </div>
  );
}
