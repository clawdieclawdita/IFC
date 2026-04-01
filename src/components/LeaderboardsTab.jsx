import { useEffect, useMemo } from 'react';

const STORAGE_KEY = 'image-converter.gamificationLeaderboard';

export function LeaderboardsTab({ period, onPeriodChange, leaderboard }) {
  const activeLeaderboard = period === 'monthly' ? leaderboard.monthly : leaderboard.weekly;

  const metrics = useMemo(() => ([
    {
      label: period === 'weekly' ? 'Weekly rank' : 'Monthly rank',
      value: `#${leaderboard.local[period === 'weekly' ? 'weeklyRank' : 'monthlyRank']}`,
      meta: activeLeaderboard.scoreLabel,
    },
    {
      label: 'Lane',
      value: leaderboard.monthly.rankLabel,
      meta: leaderboard.weekly.scoreLabel,
    },
    {
      label: 'Friend compare',
      value: leaderboard.friend.label,
      meta: leaderboard.friend.delta,
    },
  ]), [activeLeaderboard.scoreLabel, leaderboard, period]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      period,
      leaderboard,
      savedAt: new Date().toISOString(),
    }));
  }, [leaderboard, period]);

  return (
    <div className="gamification-tab gamification-tab--leaderboards">
      <div className="gamification-section-heading">
        <div>
          <p className="eyebrow">Competition deck</p>
          <h3>Weekly + monthly leaderboard</h3>
          <p className="section-copy">Local-only demo rankings, tuned to your conversion rhythm and streak energy.</p>
        </div>
        <div className="segmented-toggle leaderboard-toggle" role="tablist" aria-label="Leaderboard period">
          <button type="button" className={period === 'weekly' ? 'is-active' : ''} onClick={() => onPeriodChange('weekly')}>Weekly</button>
          <button type="button" className={period === 'monthly' ? 'is-active' : ''} onClick={() => onPeriodChange('monthly')}>Monthly</button>
        </div>
      </div>

      <div className="leaderboard-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className="leaderboard-card leaderboard-card--metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.meta}</small>
          </div>
        ))}
      </div>

      <div className="leaderboard-table leaderboard-table--lab" aria-label={`${period} leaderboard top 10`}>
        {activeLeaderboard.board.map((entry) => (
          <div key={`${period}-${entry.name}`} className={`leaderboard-row ${entry.name === 'You' ? 'leaderboard-row--you' : ''}`}>
            <div className="leaderboard-row__rank">#{entry.rank}</div>
            <div className="leaderboard-row__identity">
              <strong>{entry.name}{entry.name === 'You' ? ' · operator' : ''}</strong>
              <span>{entry.conversions} conversions · {entry.streak} day streak</span>
            </div>
            <div className="leaderboard-row__stats">
              <span>{entry.xp} XP</span>
              <small>{entry.rank <= 3 ? 'Top lane' : 'Climbing'}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
