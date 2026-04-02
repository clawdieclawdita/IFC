import { useState } from 'react';
import { LeaderboardsTab } from './LeaderboardsTab';
import { MagicMomentsTab } from './MagicMomentsTab';
import { PowerUpsTab } from './PowerUpsTab';

const TABS = [
  { id: 'leaderboards', label: 'Leaderboards' },
  { id: 'magic-moments', label: 'Magic Moments' },
  { id: 'power-ups', label: 'Power-Ups' },
];

export function GamificationLabPanel({
  period,
  onPeriodChange,
  leaderboard,
  moments,
  celebrationSoundEnabled,
  onToggleSound,
  onReplayMoment,
  xpMultiplierActive,
  xpMultiplierRemainingLabel,
  streakSaveArmed,
  achievementBoost,
  onActivateXpMultiplier,
  onArmStreakSave,
  onToggleAchievementBoost,
}) {
  const [activeTab, setActiveTab] = useState('leaderboards');

  const renderActiveTab = () => {
    if (activeTab === 'leaderboards') {
      return (
        <LeaderboardsTab
          period={period}
          onPeriodChange={onPeriodChange}
          leaderboard={leaderboard}
        />
      );
    }

    if (activeTab === 'magic-moments') {
      return (
        <MagicMomentsTab
          moments={moments}
          celebrationSoundEnabled={celebrationSoundEnabled}
          onToggleSound={onToggleSound}
          onReplayMoment={onReplayMoment}
        />
      );
    }

    return (
      <PowerUpsTab
        xpMultiplierActive={xpMultiplierActive}
        xpMultiplierRemainingLabel={xpMultiplierRemainingLabel}
        streakSaveArmed={streakSaveArmed}
        achievementBoost={achievementBoost}
        onActivateXpMultiplier={onActivateXpMultiplier}
        onArmStreakSave={onArmStreakSave}
        onToggleAchievementBoost={onToggleAchievementBoost}
      />
    );
  };

  return (
    <div className="settings-panel__content gamification-lab">
      <div className="gamification-tabs" role="tablist" aria-label="Gamification lab sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`gamification-tabs__button ${activeTab === tab.id ? 'is-active' : ''}`.trim()}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="gamification-tab-shell" role="tabpanel" aria-label={TABS.find((tab) => tab.id === activeTab)?.label}>
        {renderActiveTab()}
      </div>
    </div>
  );
}
