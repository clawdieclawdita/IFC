export function PowerUpsTab({
  xpMultiplierActive,
  xpMultiplierRemainingLabel,
  streakSaveArmed,
  achievementBoost,
  onActivateXpMultiplier,
  onArmStreakSave,
  onToggleAchievementBoost,
}) {
  return (
    <div className="gamification-tab gamification-tab--power-ups">
      <div className="gamification-section-heading">
        <div>
          <p className="eyebrow">Boost bay</p>
          <h3>Power-ups + streak protection</h3>
          <p className="section-copy">One-hour XP surge, celebration amplifier, and a streak shield for missed-day recovery.</p>
        </div>
        <div className="power-up-status-pill">{xpMultiplierActive ? `2x XP live · ${xpMultiplierRemainingLabel}` : 'Boost bay ready'}</div>
      </div>

      <div className="power-up-grid power-up-grid--lab">
        <button type="button" className={`power-up-card ${xpMultiplierActive ? 'power-up-card--active' : ''}`} onClick={onActivateXpMultiplier} disabled={xpMultiplierActive}>
          <span>2x XP boost</span>
          <strong>{xpMultiplierActive ? 'Running now' : 'Activate for 1 hour'}</strong>
          <small>{xpMultiplierActive ? `Cooldown: ${xpMultiplierRemainingLabel}` : 'Boost every conversion run for the next 60 minutes.'}</small>
        </button>

        <button type="button" className={`power-up-card ${achievementBoost ? 'power-up-card--active' : ''}`} onClick={onToggleAchievementBoost}>
          <span>Celebration amp</span>
          <strong>{achievementBoost ? 'High energy' : 'Subtle mode'}</strong>
          <small>{achievementBoost ? 'Milestones and unlocks land with full neon ceremony.' : 'Keep the lab quiet until you want the fireworks back.'}</small>
        </button>

        <button type="button" className={`power-up-card ${streakSaveArmed ? 'power-up-card--active' : ''}`} onClick={onArmStreakSave} disabled={streakSaveArmed}>
          <span>Streak shield</span>
          <strong>{streakSaveArmed ? 'Armed for 1 missed day' : 'Recharge shield'}</strong>
          <small>{streakSaveArmed ? 'Your next missed day is protected.' : 'Re-arm the shield after it has been consumed.'}</small>
        </button>
      </div>

      <div className="power-up-readout-grid">
        <div className="leaderboard-card leaderboard-card--metric">
          <span>XP multiplier</span>
          <strong>{xpMultiplierActive ? '2x active' : 'Standby'}</strong>
          <small>{xpMultiplierRemainingLabel}</small>
        </div>
        <div className="leaderboard-card leaderboard-card--metric">
          <span>Streak save</span>
          <strong>{streakSaveArmed ? 'Shield armed' : 'Recharge needed'}</strong>
          <small>{streakSaveArmed ? '1 day protected' : 'No protection stored'}</small>
        </div>
        <div className="leaderboard-card leaderboard-card--metric">
          <span>Celebration amp</span>
          <strong>{achievementBoost ? 'Neon on' : 'Quiet mode'}</strong>
          <small>{achievementBoost ? 'Big unlocks stay dramatic' : 'Toasts only, reduced spectacle'}</small>
        </div>
      </div>
    </div>
  );
}
