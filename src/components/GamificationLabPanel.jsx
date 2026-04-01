import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { LeaderboardsTab } from './LeaderboardsTab';
import { MagicMomentsTab } from './MagicMomentsTab';
import { PowerUpsTab } from './PowerUpsTab';

const TABS = [
  { id: 'leaderboards', label: 'Leaderboards', icon: '🏁' },
  { id: 'magic-moments', label: 'Magic Moments', icon: '🌠' },
  { id: 'power-ups', label: 'Power-Ups', icon: '⚡' },
];

export function GamificationLabPanel(props) {
  const {
    activeTab,
    onTabChange,
    leaderboardPeriod,
    onLeaderboardPeriodChange,
    leaderboard,
    magicMoments,
    celebrationSoundEnabled,
    onCelebrationSoundChange,
    onReplayMoment,
    xpMultiplierActive,
    xpMultiplierRemainingLabel,
    streakSaveArmed,
    achievementBoost,
    onActivateXpMultiplier,
    onArmStreakSave,
    onToggleAchievementBoost,
  } = props;

  const panelRef = useRef(null);

  useEffect(() => {
    const scope = panelRef.current;
    if (!scope) return undefined;

    const tl = gsap.timeline();
    tl.fromTo(
      '.gamification-lab__hero',
      { y: 18, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' },
    ).fromTo(
      '.gamification-tabs__button',
      { y: 10, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.28, stagger: 0.05, ease: 'power2.out' },
      '-=0.18',
    ).fromTo(
      '.gamification-tab-shell',
      { y: 24, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.4, ease: 'power3.out' },
      '-=0.12',
    );

    return () => tl.kill();
  }, [activeTab]);

  return (
    <div className="settings-panel__content gamification-lab" ref={panelRef}>
      <div className="gamification-lab__hero">
        <div>
          <p className="eyebrow">Retro-future lab</p>
          <h3>Gamification Lab</h3>
          <p className="settings-panel__description">A dedicated local-lab control room for rankings, milestone rituals, and temporary boosts — deliberately kept out of the main conversion layout.</p>
        </div>
        <div className="gamification-lab__status">
          <span>Private by default</span>
          <strong>Local storage demo mode</strong>
        </div>
      </div>

      <div className="gamification-tabs" role="tablist" aria-label="Gamification lab tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`gamification-tabs__button ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="gamification-tab-shell">
        {activeTab === 'leaderboards' ? (
          <LeaderboardsTab
            period={leaderboardPeriod}
            onPeriodChange={onLeaderboardPeriodChange}
            leaderboard={leaderboard}
          />
        ) : null}

        {activeTab === 'magic-moments' ? (
          <MagicMomentsTab
            moments={magicMoments}
            celebrationSoundEnabled={celebrationSoundEnabled}
            onToggleSound={onCelebrationSoundChange}
            onReplayMoment={onReplayMoment}
          />
        ) : null}

        {activeTab === 'power-ups' ? (
          <PowerUpsTab
            xpMultiplierActive={xpMultiplierActive}
            xpMultiplierRemainingLabel={xpMultiplierRemainingLabel}
            streakSaveArmed={streakSaveArmed}
            achievementBoost={achievementBoost}
            onActivateXpMultiplier={onActivateXpMultiplier}
            onArmStreakSave={onArmStreakSave}
            onToggleAchievementBoost={onToggleAchievementBoost}
          />
        ) : null}
      </div>
    </div>
  );
}
