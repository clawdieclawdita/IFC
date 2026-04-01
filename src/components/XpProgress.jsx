import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { getProgressFromXp } from '../utils/xp';

const LEVEL_TITLES = {
  1: 'Fresh Pixels',
  2: 'Format Scout',
  3: 'Batch Runner',
  4: 'Pipeline Pilot',
  5: 'Conversion Virtuoso',
};

const getLevelTitle = (level) => LEVEL_TITLES[level] || 'Spectrum Operator';

export default function XpProgress({ xpState, reducedMotion = false }) {
  const shellRef = useRef(null);
  const fillRef = useRef(null);
  const burstRef = useRef(null);
  const gainRef = useRef(null);
  const badgeRef = useRef(null);
  const ringRef = useRef(null);
  const countRef = useRef(null);
  const liveRegionRef = useRef(null);
  const prevXpRef = useRef(xpState?.xp ?? 0);
  const prevLevelRef = useRef(xpState?.level ?? 1);

  const xp = xpState?.xp ?? 0;
  const level = xpState?.level ?? 1;
  const streakDays = xpState?.streakDays ?? 0;
  const lastGain = xpState?.lastGain;
  const {
    levelMinXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    progressPercent,
  } = getProgressFromXp(xp);

  useGSAP(() => {
    if (!fillRef.current || !ringRef.current || !countRef.current) return;

    if (reducedMotion) {
      gsap.set(fillRef.current, { width: `${progressPercent}%` });
      gsap.set(ringRef.current, { '--ring-progress': `${progressPercent / 100}` });
      countRef.current.textContent = String(xp);
      prevXpRef.current = xp;
      prevLevelRef.current = level;
      return;
    }

    gsap.to(fillRef.current, {
      width: `${progressPercent}%`,
      duration: 0.9,
      ease: 'power3.out',
      overwrite: 'auto',
    });

    gsap.to(ringRef.current, {
      '--ring-progress': `${progressPercent / 100}`,
      duration: 1,
      ease: 'power3.out',
      overwrite: 'auto',
    });

    const counter = { value: prevXpRef.current };
    gsap.to(counter, {
      value: xp,
      duration: 1,
      ease: 'power2.out',
      overwrite: 'auto',
      onUpdate: () => {
        if (countRef.current) {
          countRef.current.textContent = String(Math.round(counter.value));
        }
      },
      onComplete: () => {
        if (countRef.current) countRef.current.textContent = String(xp);
      },
    });

    const gainedXp = xp - prevXpRef.current;
    if (gainedXp > 0 && gainRef.current && burstRef.current && badgeRef.current) {
      const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } });
      timeline
        .fromTo(shellRef.current, { y: 0 }, { y: -2, duration: 0.18, ease: 'power2.out' })
        .to(shellRef.current, { y: 0, duration: 0.4, ease: 'elastic.out(1, 0.6)' }, '<')
        .fromTo(gainRef.current, { autoAlpha: 0, y: 16, scale: 0.88 }, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.25,
          ease: 'back.out(1.7)',
        }, 0)
        .to(gainRef.current, { autoAlpha: 0, y: -18, duration: 0.45, ease: 'power2.in' }, '+=0.7')
        .fromTo(burstRef.current, { autoAlpha: 0.15, scaleX: 0.8 }, {
          autoAlpha: 0,
          scaleX: 1.28,
          duration: 0.75,
          ease: 'power2.out',
          transformOrigin: 'left center',
        }, 0)
        .fromTo(badgeRef.current, { rotate: -4, scale: 0.96 }, {
          rotate: 0,
          scale: 1,
          duration: 0.65,
          ease: 'elastic.out(1, 0.5)',
        }, 0.08);
    }

    if (level > prevLevelRef.current && badgeRef.current) {
      gsap.fromTo(badgeRef.current, {
        boxShadow: '0 0 0 rgba(87, 225, 255, 0)',
        scale: 1,
      }, {
        boxShadow: '0 0 0 16px rgba(87, 225, 255, 0)',
        scale: 1.06,
        duration: 0.8,
        ease: 'power2.out',
      });
    }

    prevXpRef.current = xp;
    prevLevelRef.current = level;
  }, { dependencies: [xp, level, progressPercent, reducedMotion], scope: shellRef });

  useEffect(() => {
    if (!liveRegionRef.current) return;
    if (!lastGain?.totalXp) return;

    liveRegionRef.current.textContent = `Gained ${lastGain.totalXp} XP. Level ${level}. ${xpForNextLevel} XP to next level.`;
  }, [lastGain, level, xpForNextLevel]);

  return (
    <section className="xp-hud" ref={shellRef} aria-label="Progress tracker">
      <div className="xp-hud__ambient" aria-hidden="true" ref={burstRef} />
      <div className="xp-hud__main">
        <div className="xp-hud__dial xp-dial" ref={ringRef}>
          <div className="xp-dial__inner" ref={badgeRef}>
            <span className="xp-dial__eyebrow">Level</span>
            <strong className="xp-dial__value">{level}</strong>
            <span className="xp-dial__title">{getLevelTitle(level)}</span>
          </div>
        </div>

        <div className="xp-hud__board">
          <div className="xp-hud__header">
            <div>
              <p className="xp-hud__eyebrow">Converter XP</p>
              <h2>Momentum meter</h2>
            </div>
            <div className="xp-hud__totals">
              <span className="xp-hud__gain" ref={gainRef} aria-hidden="true">
                +{lastGain?.totalXp ?? 0} XP
              </span>
              <strong><span ref={countRef}>{xp}</span> XP</strong>
              <span>{levelMinXp} → {nextLevelXp}</span>
            </div>
          </div>

          <div className="xp-track" aria-hidden="true">
            <div className="xp-track__grid" />
            <div className="xp-track__fill" ref={fillRef} />
            <div className="xp-track__spark xp-track__spark--alpha" />
            <div className="xp-track__spark xp-track__spark--beta" />
          </div>

          <div className="xp-hud__footer">
            <div className="xp-chip-list">
              <span className="xp-chip">{Math.round(progressPercent)}% through this level</span>
              <span className="xp-chip">{xpIntoLevel} XP in band</span>
              <span className="xp-chip">{xpForNextLevel} XP to go</span>
              <span className="xp-chip xp-chip--streak">{streakDays}-day streak</span>
            </div>
            {lastGain ? (
              <p className="xp-hud__breakdown">
                Last gain: {lastGain.baseXp} base
                {lastGain.batchBonus ? ` + ${lastGain.batchBonus} batch` : ''}
                {lastGain.firstConvertBonus ? ` + ${lastGain.firstConvertBonus} first-convert` : ''}
                {lastGain.streakMultiplier > 1 ? ` × ${lastGain.streakMultiplier} streak` : ''}
              </p>
            ) : (
              <p className="xp-hud__breakdown">First conversion unlocks a +25 XP launch bonus.</p>
            )}
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite" ref={liveRegionRef} />
    </section>
  );
}
