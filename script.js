/**
 * A Message For You - Interactive Cute Flipbook Engine
 * Supports 3D page flip, touch swiping with drag-following physics,
 * synthesized Web Audio paper rustle sounds, particle hearts, and confetti.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const book = document.getElementById('book');
  const pages = Array.from(document.querySelectorAll('.page'));
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const dotBtns = Array.from(document.querySelectorAll('.dot-btn'));
  const pageTitleLabel = document.getElementById('pageTitleLabel');
  const soundToggle = document.getElementById('soundToggle');
  const soundIcon = document.getElementById('soundIcon');
  const restartBtn = document.getElementById('restartBtn');
  const readAgainBtn = document.getElementById('readAgainBtn');
  const ribbonBookmark = document.getElementById('ribbonBookmark');
  const ambientBg = document.getElementById('ambientBg');

  // State
  let currentIndex = 0;
  const totalPages = pages.length;
  let soundEnabled = true;

  // Labels for each page
  const pageTitles = [
    'Cover Page',
    'Letter 1 • Dearest Jo',
    'Letter 2 • The Sun in Your Smile',
    'Letter 3 • A Hug in Every Line',
    'Letter 4 • With Grateful Heart',
    'Chapter IV • Melodies For You',
    'Back Cover 💌'
  ];

  // ---------------------------------------------------------
  // Web Audio Synthesizer: Realistic gentle paper rustle + chime
  // ---------------------------------------------------------
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playFlipSound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;

      // Filtered noise simulating paper whoosh / flip
      const bufferSize = Math.floor(audioCtx.sampleRate * 0.2); // 200ms
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.1);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.2);
      filter.Q.setValueAtTime(1.8, now);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start(now);

      // Sweet subtle chime
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      oscGain.gain.setValueAtTime(0.018, now);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Audio note:', e);
    }
  }

  // ---------------------------------------------------------
  // Page Transition Engine
  // ---------------------------------------------------------
  function renderPages() {
    pages.forEach((page, index) => {
      // Clear dynamic transform inline styling from dragging
      page.style.transform = '';
      page.style.opacity = '';
      page.classList.remove('is-dragging');

      if (index < currentIndex) {
        // Turned pages (flipped away to the left)
        page.classList.remove('active', 'next-peek');
        page.classList.add('turned');
      } else if (index === currentIndex) {
        // Current active page
        page.classList.remove('turned', 'next-peek');
        page.classList.add('active');
      } else if (index === currentIndex + 1) {
        // Next page waiting peek
        page.classList.remove('turned', 'active');
        page.classList.add('next-peek');
      } else {
        // Inactive future pages stacked deeper
        page.classList.remove('turned', 'active', 'next-peek');
      }
    });

    // Update navigation controls
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === totalPages - 1;

    // Update label
    pageTitleLabel.textContent = pageTitles[currentIndex] || `Page ${currentIndex}`;

    // Update indicator dots
    dotBtns.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentIndex);
    });

    // Ribbon subtle bounce animation
    if (ribbonBookmark) {
      ribbonBookmark.style.transform = 'translateY(6px)';
      setTimeout(() => {
        ribbonBookmark.style.transform = 'translateY(0)';
      }, 350);
    }

    // Back cover celebration hearts
    if (currentIndex === totalPages - 1) {
      createCelebrationBurst();
    }
  }

  function goToPage(targetIndex) {
    if (targetIndex < 0 || targetIndex >= totalPages || targetIndex === currentIndex) return;
    currentIndex = targetIndex;
    playFlipSound();
    renderPages();
  }

  function nextPage() {
    if (currentIndex < totalPages - 1) {
      currentIndex++;
      playFlipSound();
      renderPages();
    }
  }

  function prevPage() {
    if (currentIndex > 0) {
      currentIndex--;
      playFlipSound();
      renderPages();
    }
  }

  // ---------------------------------------------------------
  // Touch Swiping with Real-Time Drag Physics
  // ---------------------------------------------------------
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDeltaX = 0;
  let touchDeltaY = 0;
  let isDragging = false;
  let activePageEl = null;

  const SWIPE_THRESHOLD = 45; // px distance to confirm flip

  function onTouchStart(clientX, clientY) {
    initAudio();
    touchStartX = clientX;
    touchStartY = clientY;
    touchDeltaX = 0;
    touchDeltaY = 0;
    isDragging = true;
    activePageEl = pages[currentIndex];
  }

  function onTouchMove(clientX, clientY) {
    if (!isDragging || !activePageEl) return;
    touchDeltaX = clientX - touchStartX;
    touchDeltaY = clientY - touchStartY;

    // Only apply horizontal interactive drag if mostly horizontal
    if (Math.abs(touchDeltaX) > Math.abs(touchDeltaY)) {
      activePageEl.classList.add('is-dragging');

      if (touchDeltaX < 0 && currentIndex < totalPages - 1) {
        // Dragging left: page curls/turns toward -90deg
        const progress = Math.min(Math.abs(touchDeltaX) / 250, 1);
        const rotateY = -progress * 75;
        const scale = 1 - progress * 0.05;
        activePageEl.style.transform = `rotateY(${rotateY}deg) scale(${scale})`;
      } else if (touchDeltaX > 0 && currentIndex > 0) {
        // Dragging right: previous page peeks back in
        const prevPageEl = pages[currentIndex - 1];
        if (prevPageEl) {
          prevPageEl.classList.add('is-dragging');
          const progress = Math.min(touchDeltaX / 250, 1);
          const rotateY = -110 + progress * 80;
          prevPageEl.style.opacity = '1';
          prevPageEl.style.zIndex = '12';
          prevPageEl.style.transform = `rotateY(${rotateY}deg) scale(0.96)`;
        }
      }
    }
  }

  function onTouchEnd() {
    if (!isDragging) return;
    isDragging = false;

    // Clear dragging helper classes
    pages.forEach(p => p.classList.remove('is-dragging'));

    // Check if horizontal swipe crossed threshold
    if (Math.abs(touchDeltaX) >= SWIPE_THRESHOLD && Math.abs(touchDeltaX) > Math.abs(touchDeltaY)) {
      if (touchDeltaX < 0) {
        // Swiped Left -> Next page
        nextPage();
      } else {
        // Swiped Right -> Previous page
        prevPage();
      }
    } else {
      // Revert drag if under threshold
      renderPages();

      // If it was just a gentle tap with almost no movement
      if (Math.abs(touchDeltaX) < 10 && Math.abs(touchDeltaY) < 10) {
        handleTap(touchStartX);
      }
    }
  }

  function handleTap(clientX) {
    const bookRect = book.getBoundingClientRect();
    const relativeX = clientX - bookRect.left;
    const halfWidth = bookRect.width / 2;

    if (currentIndex === 0) {
      // Cover page tap opens the book
      nextPage();
    } else if (currentIndex === totalPages - 1) {
      // Back cover: handled by read again button or tap left to go back
      if (relativeX < halfWidth) {
        prevPage();
      }
    } else {
      // Left side goes back, right side goes forward
      if (relativeX > halfWidth) {
        nextPage();
      } else {
        prevPage();
      }
    }
  }

  // Mobile Touch Listeners
  book.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      onTouchStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  book.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      onTouchMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  book.addEventListener('touchend', () => {
    onTouchEnd();
  });

  // Desktop Mouse Drag Listeners
  let isMouseDown = false;

  book.addEventListener('mousedown', (e) => {
    // Only primary button
    if (e.button !== 0) return;
    // Don't intercept button or link clicks inside
    if (e.target.closest('button')) return;
    isMouseDown = true;
    onTouchStart(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    onTouchMove(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', () => {
    if (!isMouseDown) return;
    isMouseDown = false;
    onTouchEnd();
  });

  // ---------------------------------------------------------
  // Buttons & Controls
  // ---------------------------------------------------------
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    prevPage();
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    nextPage();
  });

  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      initAudio();
      goToPage(0);
    });
  }

  if (readAgainBtn) {
    readAgainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();
      goToPage(0);
    });
  }

  if (ribbonBookmark) {
    ribbonBookmark.addEventListener('click', () => {
      initAudio();
      // Bookmark jumps to first letter page or cover
      if (currentIndex === 1) {
        goToPage(0);
      } else {
        goToPage(1);
      }
    });
  }

  // Dots click navigation
  dotBtns.forEach((dot) => {
    dot.addEventListener('click', () => {
      initAudio();
      const target = parseInt(dot.getAttribute('data-target'), 10);
      goToPage(target);
    });
  });

  // Sound toggle button
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundIcon) soundIcon.textContent = soundEnabled ? '🔔' : '🔕';
      const tooltip = soundToggle.querySelector('.tooltip');
      if (tooltip) tooltip.textContent = soundEnabled ? 'Sound On' : 'Sound Muted';
      if (soundEnabled) {
        playFlipSound();
      }
    });
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      initAudio();
      nextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      initAudio();
      prevPage();
    } else if (e.key === 'Home') {
      initAudio();
      goToPage(0);
    } else if (e.key === 'End') {
      initAudio();
      goToPage(totalPages - 1);
    }
  });

  // ---------------------------------------------------------
  // Visual Effects: Floating Ambient Hearts & Confetti Burst
  // ---------------------------------------------------------
  const icons = ['💖', '🌸', '✨', '💕', '🌷', '⭐'];

  function createFloatingParticle() {
    if (!ambientBg) return;
    const particle = document.createElement('div');
    particle.className = 'floating-particle';
    particle.textContent = icons[Math.floor(Math.random() * icons.length)];
    particle.style.left = `${Math.random() * 95}%`;
    particle.style.fontSize = `${0.9 + Math.random() * 0.7}rem`;
    particle.style.animationDuration = `${9 + Math.random() * 7}s`;
    particle.style.animationDelay = `${Math.random() * 1.5}s`;
    particle.style.opacity = (0.25 + Math.random() * 0.45).toString();

    ambientBg.appendChild(particle);

    setTimeout(() => {
      particle.remove();
    }, 16000);
  }

  // Initial ambient particles
  for (let i = 0; i < 8; i++) {
    setTimeout(createFloatingParticle, i * 450);
  }
  setInterval(createFloatingParticle, 2400);

  // Heart confetti burst on back cover
  function createCelebrationBurst() {
    for (let i = 0; i < 16; i++) {
      setTimeout(() => {
        if (!ambientBg) return;
        const heart = document.createElement('div');
        heart.className = 'floating-particle';
        heart.textContent = ['💖', '✨', '🎉', '🌸', '💌'][Math.floor(Math.random() * 5)];
        heart.style.left = `${35 + Math.random() * 30}%`;
        heart.style.bottom = '25%';
        heart.style.animation = 'floatUp 4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards';
        heart.style.fontSize = '1.6rem';
        ambientBg.appendChild(heart);

        setTimeout(() => heart.remove(), 4500);
      }, i * 90);
    }
  }

  // ---------------------------------------------------------
  // Spotify Music Modal & Track Tab Switcher
  // ---------------------------------------------------------
  const musicPillBtn = document.getElementById('musicPillBtn');
  const openPlayerPageBtn = document.getElementById('openPlayerPageBtn');
  const musicModalBackdrop = document.getElementById('musicModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const trackTabs = Array.from(document.querySelectorAll('.track-tab'));
  const embedItems = Array.from(document.querySelectorAll('.embed-item'));
  const songRows = Array.from(document.querySelectorAll('.song-row'));

  function openMusicModal(trackIndex = null) {
    if (trackIndex !== null) {
      switchTrack(trackIndex);
    }
    if (musicModalBackdrop) {
      musicModalBackdrop.classList.add('open');
      musicModalBackdrop.setAttribute('aria-hidden', 'false');
    }
  }

  function closeMusicModal() {
    if (musicModalBackdrop) {
      musicModalBackdrop.classList.remove('open');
      musicModalBackdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function switchTrack(index) {
    trackTabs.forEach((tab, idx) => {
      tab.classList.toggle('active', idx === index);
    });
    embedItems.forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });
  }

  if (musicPillBtn) {
    musicPillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMusicModal();
    });
  }

  if (openPlayerPageBtn) {
    openPlayerPageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMusicModal();
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMusicModal();
    });
  }

  if (musicModalBackdrop) {
    musicModalBackdrop.addEventListener('click', (e) => {
      if (e.target === musicModalBackdrop) {
        closeMusicModal();
      }
    });
  }

  trackTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackIdx = parseInt(tab.getAttribute('data-track'), 10);
      switchTrack(trackIdx);
    });
  });

  songRows.forEach((row) => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const pickIdx = parseInt(row.getAttribute('data-pick'), 10);
      openMusicModal(pickIdx);
    });
  });

  // Initialize view
  renderPages();
});
