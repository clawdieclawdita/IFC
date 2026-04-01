import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';

const clampGoal = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.max(1, Math.min(100, Math.round(numeric)));
};

export default function DailyGoalPanel({
  goal = 10,
  count = 0,
  streak = 0,
  percent = 0,
  completedToday = false,
  milestone = null,
  celebrationKey = 0,
  reducedMotion = false,
  onGoalChange,
}) {
  const shellRef = useRef(null);
  const burstRef = useRef(null);
  const ringRef = useRef(null);
  const bannerRef = useRef(null);

  const remaining = Math.max(goal - count, 0);
  const displayPercent = Math.max(0, Math.min(100, Math.round(percent)));
  const particles = useMemo(() => Array.from({ length: 18 }, (_, index) => index), []);

  useEffect(() => {
    if (!celebrationKey || !shellRef.current) return undefined;

    const shell = shellRef.current;
    const burst = burstRef.current;
    const ring = ringRef.current;
    const banner = bannerRef.current;

    if (reducedMotion) {
      gsap.set([burst?.children || [], ring, banner], { clearProps: 'all' });
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        shell,
        { y: 0, rotateX: 0 },
        {
          keyframes: [
            { y: -6, rotateX: -1.5, duration: 0.16, ease: 'power2.out' },
            { y: 0, rotateX: 0, duration: 0.3, ease: 'bounce.out' },
          ],
          transformOrigin: '50% 50%',
          force3D: true,
          overwrite: 'auto',
        },
      );

      if (ring) {
        gsap.fromTo(
          ring,
          { scale: 0.82, opacity: 0.8 },
          { scale: 1.28, opacity: 0, duration: 0.75, ease: 'power2.out', overwrite: 'auto' },
        );
      }

      if (banner) {
        gsap.fromTo(
          banner,
          { yPercent: 20, autoAlpha: 0, scale: 0.96 },
          { yPercent: 0, autoAlpha: 1, scale: 1, duration: 0.42, ease: 'back.out(1.6)', overwrite: 'auto' },
        );
      }

      if (burst?.children?.length) {
        gsap.set(burst.children, {
          x: 0,
          y: 0,
          opacity: 0,
          scale: 0.4,
          rotate: 0,
          transformOrigin: '50% 50%',
          willChange: 'transform, opacity',
        });

        gsap.to(burst.children, {
          opacity: 1,
          scale: 1,
          x: (index) => Math.cos((index / burst.children.length) * Math.PI * 2) * (68 + (index % 3) * 18),
          y: (index) => Math.sin((index / burst.children.length) * Math.PI * 2) * (44 + (index % 4) * 14),
          rotate: (index) => (index % 2 === 0 ? 1 : -1) * (85 + index * 4),
          duration: 0.9,
          ease: 'power3.out',
          stagger: { each: 0.015, from: 'random' },
          overwrite: 'auto',
        });

        gsap.to(burst.children, {
          opacity: 0,
          scale: 0.2,
          duration: 0.45,
          delay: 0.45,
          ease: 'power2.in',
          stagger: { each: 0.01, from: 'random' },
          overwrite: 'auto',
        });
      }
    }, shell);

    return () => ctx.revert();
  }, [celebrationKey, reducedMotion]);

  return (
    <section
      ref={shellRef}
      className={`daily-goal-panel${completedToday ? ' daily-goal-panel--complete' : ''}`}
      aria-label="Daily conversion goal"
      data-goal-state={completedToday ? 'complete' : 'active'}
    >
      <div className="daily-goal-panel__header">
        <div>
          <p className="daily-goal-panel__eyebrow">Daily rhythm</p>
          <h2>Conversion streak engine</h2>
          <p className="daily-goal-panel__copy">
            Set your target, watch the neon runway fill, and keep your streak alive day after day.
          </p>
        </div>

        <label className="daily-goal-panel__input" htmlFor="daily-goal-input">
          <span>Daily goal</span>
          <div className="daily-goal-panel__input-shell">
            <input
              id="daily-goal-input"
              type="number"
              min="1"
              max="100"
              step="1"
              value={goal}
              onChange={(event) => onGoalChange(clampGoal(event.target.value))}
              aria-describedby="daily-goal-caption"
            />
            <strong>images</strong>
          </div>
          <small id="daily-goal-caption">Tune it from 1 to 100 conversions.</small>
        </label>
      </div>

      <div className="daily-goal-panel__metrics">
        <article className="goal-metric-card goal-metric-card--count">
          <span className="goal-metric-card__label">Today</span>
          <strong>{count}</strong>
          <small>{remaining ? `${remaining} to go` : 'Goal met'}</small>
        </article>
        <article className="goal-metric-card goal-metric-card--streak">
          <span className="goal-metric-card__label">Current streak</span>
          <strong>{streak}</strong>
          <small>{streak === 1 ? 'day' : 'days'} on fire</small>
        </article>
        <article className="goal-metric-card goal-metric-card--goal">
          <span className="goal-metric-card__label">Target</span>
          <strong>{goal}</strong>
          <small>{displayPercent}% charged</small>
        </article>
      </div>

      <div className="daily-goal-runway" aria-live="polite">
        <div className="daily-goal-runway__meta">
          <span>Progress runway</span>
          <strong>{displayPercent}%</strong>
        </div>
        <div className="daily-goal-runway__track">
          <div className="daily-goal-runway__grid" aria-hidden="true" />
          <div className="daily-goal-runway__fill" style={{ width: `${displayPercent}%` }} />
          <div ref={ringRef} className="daily-goal-runway__ring" aria-hidden="true" />
          <div className="daily-goal-runway__marker daily-goal-runway__marker--start">Launch</div>
          <div className={`daily-goal-runway__marker daily-goal-runway__marker--finish${completedToday ? ' is-live' : ''}`}>
            Goal met
          </div>
        </div>
      </div>

      <div className="daily-goal-panel__footer">
        <div
          ref={bannerRef}
          className={`daily-goal-banner${completedToday ? ' daily-goal-banner--visible' : ''}`}
          role="status"
          aria-live="polite"
        >
          <strong>{completedToday ? 'Daily Goal Met' : 'Keep the streak glowing'}</strong>
          <span>
            {milestone ? `${milestone}-day streak unlocked.` : completedToday ? 'You hit today’s conversion target.' : 'Each completed conversion feeds today’s runway.'}
          </span>
        </div>

        <div ref={burstRef} className="daily-goal-burst" aria-hidden="true">
          {particles.map((particle) => (
            <span key={particle} className={`daily-goal-burst__particle daily-goal-burst__particle--${particle % 4}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
