/* =============================================================
   AUDIO — Player + per-file download for offline use
   Uses Cache API to store downloaded audio files.
   ============================================================= */

(function (global) {
  'use strict';

  const CACHE_NAME = 'hajj-audio-v1';
  const cacheAvailable = 'caches' in window;

  const Audio = {
    activePlayer: null,

    /**
     * Render a small player UI for a single dua.
     */
    renderPlayer(container, dua) {
      container.innerHTML = '';
      if (!dua.audioUrl) {
        container.appendChild(Utils.el('span', { class: 'text-mute italic', style: { fontSize: '12px' } },
          'Audio coming soon'
        ));
        return;
      }

      const wrap = Utils.el('div', { class: 'audio-controls' });

      // Play button
      const playBtn = Utils.el('button', {
        class: 'btn btn--icon',
        'aria-label': 'Play audio',
        title: 'Play',
      }, '▶');

      // Download button
      const dlBtn = Utils.el('button', {
        class: 'btn btn--icon',
        'aria-label': 'Download for offline',
        title: 'Download for offline',
      });
      this.updateDownloadIcon(dlBtn, dua.id);

      // Audio element (hidden)
      const audio = Utils.el('audio', { preload: 'none' });
      const source = Utils.el('source', { src: dua.audioUrl, type: 'audio/mpeg' });
      audio.appendChild(source);

      // Play/pause logic
      let playing = false;
      playBtn.addEventListener('click', async () => {
        if (this.activePlayer && this.activePlayer !== audio) {
          this.activePlayer.pause();
          this.activePlayer.currentTime = 0;
        }
        if (playing) {
          audio.pause();
          playing = false;
          playBtn.textContent = '▶';
        } else {
          // Try cached version first
          const cached = await this.getCachedUrl(dua.audioUrl);
          if (cached) {
            audio.src = cached;
          }
          try {
            await audio.play();
            playing = true;
            playBtn.textContent = '❚❚';
            this.activePlayer = audio;
          } catch (e) {
            Utils.toast('Could not play audio. Check your connection.', 'warn');
          }
        }
      });

      audio.addEventListener('ended', () => {
        playing = false;
        playBtn.textContent = '▶';
      });

      // Download logic
      dlBtn.addEventListener('click', async () => {
        const isCached = await this.isCached(dua.audioUrl);
        if (isCached) {
          // Already cached — option to remove
          if (confirm(`"${dua.title}" is already downloaded. Remove from offline cache?`)) {
            await this.removeFromCache(dua.audioUrl);
            this.updateDownloadIcon(dlBtn, dua.id);
            Utils.toast('Removed from offline cache');
          }
          return;
        }
        dlBtn.disabled = true;
        dlBtn.textContent = '⏳';
        try {
          await this.downloadOne(dua.audioUrl);
          Store.markAudioDownloaded(dua.id);
          this.updateDownloadIcon(dlBtn, dua.id);
          Utils.toast('Saved for offline use');
        } catch (e) {
          Utils.toast('Download failed', 'warn');
          this.updateDownloadIcon(dlBtn, dua.id);
        } finally {
          dlBtn.disabled = false;
        }
      });

      wrap.appendChild(playBtn);
      wrap.appendChild(dlBtn);
      wrap.appendChild(audio);
      container.appendChild(wrap);
    },

    async updateDownloadIcon(btn, duaId) {
      const audioUrl = btn.dataset.url;
      const cached = await this.isCachedById(duaId);
      btn.textContent = cached ? '✓' : '⬇';
      btn.style.color = cached ? 'var(--green-deep)' : '';
    },

    async isCached(url) {
      if (!cacheAvailable) return false;
      try {
        const cache = await caches.open(CACHE_NAME);
        const match = await cache.match(url);
        return !!match;
      } catch (e) {
        return false;
      }
    },

    async isCachedById(duaId) {
      // Check via Store flag — simpler than re-checking cache
      return !!(Store.get().audioCache && Store.get().audioCache[duaId]);
    },

    async getCachedUrl(originalUrl) {
      if (!cacheAvailable) return null;
      try {
        const cache = await caches.open(CACHE_NAME);
        const match = await cache.match(originalUrl);
        if (match) {
          const blob = await match.blob();
          return URL.createObjectURL(blob);
        }
      } catch (e) {}
      return null;
    },

    async downloadOne(url) {
      if (!cacheAvailable) throw new Error('Cache API unavailable');
      const cache = await caches.open(CACHE_NAME);
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Fetch failed');
      await cache.put(url, res);
    },

    async removeFromCache(url) {
      if (!cacheAvailable) return;
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.delete(url);
      } catch (e) {}
    },

    /**
     * Download all duas for offline use. Shows progress.
     */
    async downloadAll(duas, onProgress) {
      if (!cacheAvailable) {
        Utils.toast('Offline cache not supported on this browser', 'warn');
        return;
      }
      const withAudio = duas.filter(d => d.audioUrl);
      let done = 0;
      const failures = [];
      for (const dua of withAudio) {
        try {
          await this.downloadOne(dua.audioUrl);
          Store.markAudioDownloaded(dua.id);
        } catch (e) {
          failures.push(dua.title);
        }
        done++;
        if (onProgress) onProgress(done, withAudio.length);
      }
      if (failures.length === 0) {
        Utils.toast(`All ${done} audio files saved offline`);
      } else {
        Utils.toast(`Saved ${done - failures.length} of ${withAudio.length} (some failed)`, 'warn');
      }
    },

    async clearAll() {
      if (!cacheAvailable) return;
      try {
        await caches.delete(CACHE_NAME);
        const s = Store.get();
        s.audioCache = {};
        Store.set(s);
        Utils.toast('Audio cache cleared');
      } catch (e) {
        Utils.toast('Failed to clear cache', 'warn');
      }
    },

    async getCacheSize() {
      if (!('storage' in navigator) || !navigator.storage.estimate) return null;
      try {
        const est = await navigator.storage.estimate();
        return est.usage || 0;
      } catch (e) { return null; }
    }
  };

  global.AudioMod = Audio;
})(window);
