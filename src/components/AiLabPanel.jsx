import { useEffect, useMemo, useState } from 'react';
import { generateAiPreview, getPreviewSourceFile, getStylePresetMeta } from '../utils/aiProcessing';

const STYLE_PRESETS = getStylePresetMeta();

export function AiLabPanel({ aiState, onAiChange, onUndo, onRedo, canUndo, canRedo, files, skipMap, onToggleSkip, leaderboard, onShareAchievement }) {
  const [previewSrc, setPreviewSrc] = useState('');
  const [previewMode, setPreviewMode] = useState('after');

  const heroFile = files[0] || null;

  useEffect(() => {
    let cancelled = false;
    let beforeUrl = '';

    const buildPreview = async () => {
      if (!heroFile?.type?.startsWith('image/')) {
        setPreviewSrc('');
        return;
      }

      const previewSourceFile = await getPreviewSourceFile(heroFile);
      if (cancelled) return;

      if (previewMode === 'before') {
        beforeUrl = URL.createObjectURL(previewSourceFile);
        setPreviewSrc(beforeUrl);
        return () => URL.revokeObjectURL(beforeUrl);
      }

      try {
        const nextPreview = await generateAiPreview(previewSourceFile, aiState);
        if (!cancelled) setPreviewSrc(nextPreview);
      } catch {
        if (!cancelled) setPreviewSrc('');
      }

      return undefined;
    };

    let cleanup;
    buildPreview().then((dispose) => { cleanup = dispose; });

    return () => {
      cancelled = true;
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      cleanup?.();
    };
  }, [aiState, heroFile, previewMode]);

  const queueCards = useMemo(() => files.slice(0, 5), [files]);

  return (
    <div className="settings-panel__content ai-lab-panel">
      <div className="ai-lab-panel__hero">
        <div>
          <h3>AI Lab</h3>
          <p className="settings-panel__description">Magical local image intelligence: one-click polish, quick background cuts, style transfer, and batch-aware control.</p>
        </div>
        <div className="ai-lab-panel__history">
          <button type="button" className="secondary-button secondary-button--small" onClick={onUndo} disabled={!canUndo}>Undo</button>
          <button type="button" className="secondary-button secondary-button--small" onClick={onRedo} disabled={!canRedo}>Redo</button>
        </div>
      </div>

      <div className="ai-orbit-grid">
        <article className="ai-orbit-card ai-orbit-card--toggle">
          <div className="ai-orbit-card__topline"><span>AI Engine</span><strong>{aiState.enabled ? 'Armed' : 'Idle'}</strong></div>
          <label className="checkbox-label" htmlFor="ai-enabled-toggle">
            <input id="ai-enabled-toggle" type="checkbox" checked={aiState.enabled} onChange={(e) => onAiChange('enabled', e.target.checked)} />
            <span>Enable AI-assisted processing</span>
          </label>
          <p className="setting-helper">Keeps the existing conversion path, but pre-tunes the image locally before export.</p>
        </article>

        <article className="ai-orbit-card">
          <div className="ai-orbit-card__topline"><span>Auto-enhancement</span><strong>1-click polish</strong></div>
          <label className="checkbox-label" htmlFor="ai-auto-enhance">
            <input id="ai-auto-enhance" type="checkbox" checked={aiState.autoEnhance} onChange={(e) => onAiChange('autoEnhance', e.target.checked)} />
            <span>Brightness · contrast · saturation · sharpness</span>
          </label>
        </article>

        <article className="ai-orbit-card">
          <div className="ai-orbit-card__topline"><span>Background removal</span><strong>Magic wand</strong></div>
          <label className="checkbox-label" htmlFor="ai-bg-removal">
            <input id="ai-bg-removal" type="checkbox" checked={aiState.backgroundRemoval} onChange={(e) => onAiChange('backgroundRemoval', e.target.checked)} />
            <span>Lift subjects from flat backgrounds</span>
          </label>
          <p className="setting-helper">Preview before/after below, then undo/redo if you want to rewind.</p>
        </article>
      </div>

      <div className="ai-preview-stage">
        <div className="ai-preview-stage__copy">
          <h4>Preview chamber</h4>
          <p>{heroFile ? `Using ${heroFile.name} as the live preview source.` : 'Upload an image to unlock the AI preview chamber.'}</p>
          <div className="segmented-toggle" role="group" aria-label="AI preview mode">
            <button type="button" className={previewMode === 'before' ? 'is-active' : ''} onClick={() => setPreviewMode('before')}>Before</button>
            <button type="button" className={previewMode === 'after' ? 'is-active' : ''} onClick={() => setPreviewMode('after')}>After</button>
          </div>
        </div>
        <div className="ai-preview-stage__frame">
          {previewSrc ? <img src={previewSrc} alt={heroFile?.name || 'AI preview'} /> : <div className="ai-preview-stage__empty">No preview yet</div>}
        </div>
      </div>

      <div className="ai-style-lab">
        <div>
          <h4>Style transfer presets</h4>
          <p className="setting-helper">Distinctive looks, adjustable intensity, no generic filter grid vibes.</p>
        </div>
        <div className="ai-style-grid">
          {Object.entries(STYLE_PRESETS).filter(([key]) => key !== 'none').map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className={`style-chip ${aiState.stylePreset === key ? 'style-chip--active' : ''}`}
              onClick={() => onAiChange('stylePreset', aiState.stylePreset === key ? 'none' : key)}
            >
              <span>{preset.label}</span>
              <small>{key === 'vintage' ? 'Warm grain' : key === 'blackwhite' ? 'Monochrome drama' : key === 'cinematic' ? 'High mood' : 'Gallery pop'}</small>
            </button>
          ))}
        </div>
        <label className="select-label ai-intensity-slider" htmlFor="ai-style-intensity">
          <span>Intensity</span>
          <input
            id="ai-style-intensity"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={aiState.styleIntensity}
            onChange={(e) => onAiChange('styleIntensity', Number(e.target.value))}
          />
          <strong>{Math.round(aiState.styleIntensity * 100)}%</strong>
        </label>
      </div>

      <div className="ai-batch-grid">
        <article className="ai-batch-card">
          <div className="ai-orbit-card__topline"><span>Batch AI processing</span><strong>{files.length} in queue</strong></div>
          <label className="checkbox-label" htmlFor="ai-batch-enabled">
            <input id="ai-batch-enabled" type="checkbox" checked={aiState.batchEnabled} onChange={(e) => onAiChange('batchEnabled', e.target.checked)} />
            <span>Apply AI stack to the entire batch</span>
          </label>
          <p className="setting-helper">Skip any image below to leave it clean while the rest of the queue gets processed.</p>
          <div className="ai-batch-queue">
            {queueCards.length ? queueCards.map((file) => {
              const key = `${file.name}-${file.size}-${file.lastModified}`;
              const skipped = Boolean(skipMap[key]);
              return (
                <div key={key} className={`ai-batch-row ${skipped ? 'is-skipped' : ''}`}>
                  <div>
                    <strong>{file.name}</strong>
                    <span>{skipped ? 'AI skipped' : 'AI ready'}</span>
                  </div>
                  <button type="button" className="secondary-button secondary-button--small" onClick={() => onToggleSkip(key)}>
                    {skipped ? 'Use AI' : 'Skip'}
                  </button>
                </div>
              );
            }) : <div className="ai-batch-row ai-batch-row--empty">No queued images yet.</div>}
          </div>
        </article>

        <article className="ai-batch-card ai-batch-card--leaderboard">
          <div className="ai-orbit-card__topline"><span>Leaderboard</span><strong>Local-only</strong></div>
          <div className="mini-board">
            <div>
              <span>Weekly</span>
              <strong>{leaderboard.weekly.rankLabel}</strong>
              <small>{leaderboard.weekly.scoreLabel}</small>
            </div>
            <div>
              <span>Monthly</span>
              <strong>{leaderboard.monthly.rankLabel}</strong>
              <small>{leaderboard.monthly.scoreLabel}</small>
            </div>
            <div>
              <span>Friend compare</span>
              <strong>{leaderboard.friend.label}</strong>
              <small>{leaderboard.friend.delta}</small>
            </div>
          </div>
          <button type="button" className="primary-button" onClick={onShareAchievement}>Share current flex</button>
        </article>
      </div>
    </div>
  );
}
