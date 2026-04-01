import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const MILESTONE_COPY = {
  10: 'First neon checkpoint reached.',
  50: 'Half-century pulse detected.',
  100: 'Triple-digit lab status achieved.',
};

export function MagicMomentsTab({ moments, celebrationSoundEnabled, onToggleSound, onReplayMoment }) {
  const stageRef = useRef(null);

  useEffect(() => {
    const scope = stageRef.current;
    if (!scope) return undefined;

    const particles = scope.querySelectorAll('.magic-moment-stage__particle');
    const tl = gsap.timeline();
    tl.fromTo(
      '.magic-moment-stage__ring',
      { scale: 0.84, autoAlpha: 0.5 },
      { scale: 1.04, autoAlpha: 1, duration: 0.45, ease: 'power2.out' },
    ).to(
      '.magic-moment-stage__ring',
      { scale: 1, duration: 0.3, ease: 'power2.out' },
      '-=0.08',
    );

    particles.forEach((particle, index) => {
      tl.fromTo(
        particle,
        { autoAlpha: 0, x: 0, y: 0, scale: 0.4 },
        {
          autoAlpha: 1,
          x: Number(particle.dataset.x || 0),
          y: Number(particle.dataset.y || 0),
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
        },
        index * 0.03,
      );
    });

    return () => tl.kill();
  }, [moments.length]);

  const latestMoment = moments[0] || null;

  return (
    <div className="gamification-tab gamification-tab--magic-moments">
      <div className="gamification-section-heading">
        <div>
          <p className="eyebrow">Magic moments</p>
          <h3>Milestone detector</h3>
          <p className="section-copy">Every 10th, 50th, and 100th conversion gets archived as a lab event with replayable motion.</p>
        </div>
        <label className="checkbox-label gamification-toggle" htmlFor="magic-moments-sound-toggle">
          <input
            id="magic-moments-sound-toggle"
            type="checkbox"
            checked={celebrationSoundEnabled}
            onChange={(event) => onToggleSound(event.target.checked)}
          />
          <span>Sound effects</span>
        </label>
      </div>

      <div className="magic-moment-grid">
        <article className="magic-moment-stage" ref={stageRef}>
          <div className="magic-moment-stage__ring" />
          <div className="magic-moment-stage__core">
            <span>Latest moment</span>
            <strong>{latestMoment ? `${latestMoment.milestone}th Conversion!` : 'Awaiting ignition'}</strong>
            <small>{latestMoment ? MILESTONE_COPY[latestMoment.milestone] : 'Convert more images to unlock neon milestone events.'}</small>
          </div>
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="magic-moment-stage__particle"
              data-x={Math.round(Math.cos((index / 18) * Math.PI * 2) * (58 + (index % 3) * 16))}
              data-y={Math.round(Math.sin((index / 18) * Math.PI * 2) * (58 + (index % 4) * 12))}
            />
          ))}
        </article>

        <article className="magic-moment-log">
          <div className="magic-moment-log__header">
            <h4>Milestone history</h4>
            {latestMoment ? (
              <button type="button" className="secondary-button secondary-button--small" onClick={() => onReplayMoment(latestMoment)}>
                Replay latest
              </button>
            ) : null}
          </div>
          <div className="magic-moment-log__list" aria-label="Milestone conversion history">
            {moments.length ? moments.map((moment) => (
              <button key={moment.id} type="button" className="magic-moment-log__item" onClick={() => onReplayMoment(moment)}>
                <div>
                  <strong>{moment.milestone}th Conversion!</strong>
                  <span>{moment.label}</span>
                </div>
                <small>{moment.timestampLabel}</small>
              </button>
            )) : (
              <div className="magic-moment-log__empty">No milestone history yet. Your first notable pulse lands at 10 conversions.</div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
