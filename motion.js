/* ============================================================
   Оранжерея — motion controller
   Только compositor-friendly свойства: transform, opacity, clip-path.
   ============================================================ */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReduced = () => reduced.matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const raf = window.requestAnimationFrame.bind(window);

  function initProgress() {
    const progress = document.createElement('div');
    progress.className = 'motion-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        raf(update);
      }
    }, { passive: true });
    update();
  }

  function initHeroParallax() {
    const hero = document.querySelector('.hero');
    const visual = document.querySelector('.hero__visual');
    const archPanel = document.querySelector('.arch__panel');
    const archPhoto = document.querySelector('.arch__photo');
    if (!hero || !visual || prefersReduced()) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = hero.getBoundingClientRect();
      const progress = clamp(-rect.top / Math.max(rect.height, 1), 0, 1);
      visual.style.setProperty('--hero-depth', (progress * 34).toFixed(2));
      if (archPanel) archPanel.style.setProperty('--arch-depth', (progress * 18).toFixed(2));
      if (archPhoto) archPhoto.style.setProperty('--photo-depth', (progress * 12).toFixed(2));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  function initCardSpotlight() {
    document.querySelectorAll('.card').forEach(card => {
      let frame = 0;
      let x = 50;
      let y = 15;
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        x = ((event.clientX - rect.left) / rect.width) * 100;
        y = ((event.clientY - rect.top) / rect.height) * 100;
        if (!frame) {
          frame = raf(() => {
            frame = 0;
            card.style.setProperty('--spot-x', `${x.toFixed(1)}%`);
            card.style.setProperty('--spot-y', `${y.toFixed(1)}%`);
          });
        }
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--spot-x', '50%');
        card.style.setProperty('--spot-y', '15%');
      });
    });
  }

  function initMagneticButtons() {
    if (prefersReduced()) return;
    document.querySelectorAll('.btn, .service__cta').forEach(button => {
      button.dataset.magnetic = 'true';
      button.addEventListener('pointermove', event => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
        const y = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
        button.style.transform = `translate3d(${(x * 7).toFixed(2)}px, ${(y * 5).toFixed(2)}px, 0)`;
      });
      button.addEventListener('pointerleave', () => {
        button.style.transform = '';
      });
    });
  }

  function initRipples() {
    document.addEventListener('click', event => {
      const target = event.target.closest('.btn, .card__add');
      if (!target || prefersReduced()) return;
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'motion-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  }

  function init() {
    document.documentElement.classList.add('motion-ready');
    if (!prefersReduced()) {
      initProgress();
      initHeroParallax();
      initMagneticButtons();
      initCardSpotlight();
      initRipples();
    }
    reduced.addEventListener?.('change', () => {
      if (reduced.matches) document.documentElement.classList.add('motion-reduced');
      else document.documentElement.classList.remove('motion-reduced');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
