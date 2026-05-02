/**
 * Audio module — simple playback manager for dua audio clips.
 *
 * Design notes:
 * - Single shared HTMLAudioElement (one instance, reused). Cheaper than
 *   creating a new Audio() per dua and avoids overlapping playback.
 * - Click-to-play only. No auto-play. Clicking another dua's button while
 *   one is playing stops the first and starts the second.
 * - Each rendered button registers itself so the module can update its
 *   visual state (idle / loading / playing / paused / error) when playback
 *   transitions on the underlying element.
 * - No persistent state across page loads. Each session starts fresh.
 *
 * Usage from guide.js:
 *
 *   const btn = Audio.createButton(dua);  // returns a DOM element or null
 *   if (btn) cardEl.appendChild(btn);
 *
 * The button element auto-cleans listeners when removed via DOM mutation.
 */
(function () {
  'use strict';

  // Capture the browser's native Audio constructor BEFORE we publish our
  // own global, so our internal use of new Audio() doesn't recurse into
  // our own module.
  const NativeAudio = window.Audio;

  // The single shared audio element used for all playback. Created lazily
  // so we don't initialise audio infrastructure unless a dua actually
  // tries to play.
  let mediaEl = null;

  // The button currently driving playback. We track it so we can update
  // its visual state when the audio element fires events.
  let activeButton = null;

  // Set of all known buttons, used to reset others when a new one starts.
  const knownButtons = new WeakSet();

  function ensureMedia() {
    if (mediaEl) return mediaEl;
    // Use the browser's native Audio constructor (via window.Audio reference
    // captured at module load, before we shadow it below).
    mediaEl = new NativeAudio();
    mediaEl.preload = 'none'; // Don't fetch until user clicks play

    // When playback ends naturally, reset the active button to idle.
    mediaEl.addEventListener('ended', () => {
      setButtonState(activeButton, 'idle');
      activeButton = null;
    });

    // Handle network/decode errors with a visible state on the button.
    mediaEl.addEventListener('error', () => {
      setButtonState(activeButton, 'error');
      activeButton = null;
    });

    // While the file is being fetched, show a loading state. Once playback
    // actually begins (the 'play' event), switch to playing.
    mediaEl.addEventListener('waiting', () => setButtonState(activeButton, 'loading'));
    mediaEl.addEventListener('play',     () => setButtonState(activeButton, 'playing'));
    mediaEl.addEventListener('pause',    () => {
      // Distinguish user pause (still active button) from end-of-stream
      // (handled by 'ended' above). After 'pause', the user can press play
      // again and resume.
      if (activeButton) setButtonState(activeButton, 'paused');
    });

    return mediaEl;
  }

  /**
   * Set a button's visual state. We use data-state on the element so CSS
   * can style each state, plus a screen-reader label so the action is
   * always meaningful.
   */
  function setButtonState(button, state) {
    if (!button) return;
    button.dataset.state = state;
    const labels = {
      idle:    'Play audio',
      loading: 'Loading audio…',
      playing: 'Pause audio',
      paused:  'Resume audio',
      error:   'Audio unavailable — tap to retry',
    };
    button.setAttribute('aria-label', labels[state] || 'Play audio');
    button.title = labels[state] || 'Play audio';
  }

  /**
   * Stop whatever is currently playing and clear the active button.
   * Called when a new button is activated.
   */
  function stopActive() {
    if (mediaEl) {
      mediaEl.pause();
      // Reset position so the next play() starts from the top.
      try { mediaEl.currentTime = 0; } catch (e) { /* some sources don't support seek */ }
    }
    if (activeButton) {
      setButtonState(activeButton, 'idle');
      activeButton = null;
    }
  }

  /**
   * Toggle a button: if it's the active one, pause; otherwise start it.
   */
  function toggle(button, audioUrl) {
    const m = ensureMedia();

    // Same button as active → pause/resume in place.
    if (activeButton === button) {
      if (m.paused) {
        m.play().catch(() => setButtonState(button, 'error'));
      } else {
        m.pause();
      }
      return;
    }

    // Different button (or none active) → stop current, switch source, play.
    stopActive();
    activeButton = button;
    setButtonState(button, 'loading');

    // Setting src triggers a fresh load. Some browsers ignore identical
    // src reassignment, so we always set it explicitly here.
    m.src = audioUrl;
    m.play().catch(() => {
      // Common causes: invalid URL, CORS rejection, codec unsupported,
      // user gesture missing. We treat all as a generic error state and
      // let the user retry by clicking again.
      setButtonState(button, 'error');
      activeButton = null;
    });
  }

  /**
   * Build a play-button element for a given dua. Returns null if the dua
   * has no audioUrl (so callers can append unconditionally).
   *
   * The button is a small circular icon. State drives its appearance via
   * data-state and CSS in styles.css (see .dua-audio-btn rules).
   */
  function createButton(dua) {
    if (!dua || !dua.audioUrl) return null;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dua-audio-btn';
    setButtonState(button, 'idle');

    // Inline SVG so the button has no external dependencies and can be
    // restyled via currentColor.
    button.innerHTML = `
      <svg class="dua-audio-btn__play" width="14" height="14" viewBox="0 0 24 24"
           fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <svg class="dua-audio-btn__pause" width="14" height="14" viewBox="0 0 24 24"
           fill="currentColor" aria-hidden="true">
        <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
      </svg>
      <span class="dua-audio-btn__spinner" aria-hidden="true"></span>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(button, dua.audioUrl);
    });

    knownButtons.add(button);
    return button;
  }

  /**
   * Halt all playback. Useful when the user navigates away from a tab
   * or closes a card containing audio.
   */
  function stopAll() {
    stopActive();
  }

  // Publish under DuaAudio so we don't shadow the browser's built-in Audio
  // constructor. Other modules read this as window.DuaAudio.createButton(...).
  window.DuaAudio = {
    createButton,
    stopAll,
  };
})();
