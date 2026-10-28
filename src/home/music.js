(() => {
  'use strict';

  const tracks = [
    { title: 'Cloud Drift', file: 'audio/cloud-drift.wav' },
    { title: 'Morning Lake Drift', file: 'audio/candidates/morning-lake-drift.wav' },
    { title: 'First Light', file: 'audio/first-light.wav' }
  ];
  const audio = document.getElementById('music-audio');
  const title = document.getElementById('music-title');
  const playButton = document.getElementById('music-play');
  const prevButton = document.getElementById('music-prev');
  const nextButton = document.getElementById('music-next');
  const muteButton = document.getElementById('music-mute');
  const volumeInput = document.getElementById('music-volume');
  const meter = document.querySelector('.music-meter');
  const bars = [...meter.querySelectorAll('span')];
  const status = document.getElementById('music-status');
  const error = document.getElementById('music-error');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let index = 1;
  let context, source, analyser, gain;
  let frequencyData, meterFrame = 0, operation = 0;
  let fallbackFadeFrame = 0;
  let muted = false;
  let volume = Number(volumeInput.value);

  function setupAudio() {
    // Browsers treat file:// media as an opaque origin. Connecting that media
    // to Web Audio can produce silence, so direct-file previews use <audio>.
    if (location.protocol === 'file:') {
      audio.volume = 0;
      return;
    }
    if (!(window.AudioContext || window.webkitAudioContext)) {
      audio.volume = 0;
      return;
    }
    if (context) return;
    context = new (window.AudioContext || window.webkitAudioContext)();
    source = context.createMediaElementSource(audio);
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.minDecibels = -85;
    analyser.maxDecibels = -25;
    analyser.smoothingTimeConstant = .85;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    gain = context.createGain();
    gain.gain.value = 0;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);
    audio.volume = 1;
  }

  function targetVolume() { return muted ? 0 : volume; }

  function fadeTo(value, seconds) {
    if (gain && context) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(value, now + seconds);
    } else {
      cancelAnimationFrame(fallbackFadeFrame);
      const initial = audio.volume;
      const start = performance.now();
      const duration = Math.max(1, seconds * 1000);
      const step = now => {
        const t = Math.min(1, (now - start) / duration);
        audio.volume = initial + (value - initial) * t;
        if (t < 1) fallbackFadeFrame = requestAnimationFrame(step);
        else fallbackFadeFrame = 0;
      };
      fallbackFadeFrame = requestAnimationFrame(step);
    }
  }

  function syncButtons(playing) {
    playButton.classList.toggle('is-playing', playing);
    playButton.setAttribute('aria-pressed', String(playing));
    playButton.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    muteButton.classList.toggle('is-muted', muted);
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.setAttribute('aria-label', muted ? 'Restore sound' : 'Mute music');
  }

  function idleMeter() {
    cancelAnimationFrame(meterFrame);
    meterFrame = 0;
    bars.forEach(bar => { bar.style.height = ''; });
  }

  function animateMeter() {
    if (audio.paused || reducedMotion.matches) {
      idleMeter();
      return;
    }
    if (analyser) {
      analyser.getByteFrequencyData(frequencyData);
      const bands = [[2,5],[5,9],[9,14],[14,22],[22,34]];
      bands.forEach(([start, end], i) => {
        let energy = 0;
        for (let n = start; n < end; n++) energy += frequencyData[n];
        energy /= end - start;
        const target = 7 + Math.min(22, energy / 255 * 27);
        const previous = parseFloat(bars[i].style.height) || [21,15,25,12,19][i];
        bars[i].style.height = (previous * .78 + target * .22).toFixed(1) + 'px';
      });
    } else {
      // Audio remains real on file://; only the decorative bars use a gentle
      // preset motion because the browser withholds frequency data.
      const time = performance.now() / 1000;
      bars.forEach((bar, i) => {
        const target = Math.max(7, 11 + 5 * Math.sin(time * (1.25 + i * .11) + i * 1.3)
          + 2.5 * Math.sin(time * .67 + i * 2.1));
        const previous = parseFloat(bar.style.height) || [21,15,25,12,19][i];
        bar.style.height = (previous * .82 + target * .18).toFixed(1) + 'px';
      });
    }
    meterFrame = requestAnimationFrame(animateMeter);
  }

  async function start() {
    const action = ++operation;
    error.hidden = true;
    try {
      setupAudio();
      if (context) await context.resume();
      if (action !== operation) return;
      fadeTo(0, .01);
      await audio.play();
      if (action !== operation) { audio.pause(); return; }
      fadeTo(targetVolume(), .38);
      syncButtons(true);
      status.textContent = 'Playing ' + tracks[index].title;
      if (!meterFrame) animateMeter();
    } catch (problem) {
      audio.pause();
      idleMeter();
      syncButtons(false);
      error.hidden = false;
      status.textContent = 'Audio could not play';
      console.warn('Music playback unavailable:', problem);
    }
  }

  function pause() {
    const action = ++operation;
    fadeTo(0, .25);
    syncButtons(false);
    idleMeter();
    status.textContent = 'Music paused';
    setTimeout(() => {
      if (action === operation) audio.pause();
    }, 260);
  }

  async function changeTrack(direction) {
    const wasPlaying = playButton.classList.contains('is-playing');
    const action = ++operation;
    if (wasPlaying) {
      fadeTo(0, .18);
      await new Promise(resolve => setTimeout(resolve, 190));
      if (action !== operation) return;
    }
    audio.pause();
    index = (index + direction + tracks.length) % tracks.length;
    audio.src = tracks[index].file;
    audio.load();
    title.textContent = tracks[index].title;
    idleMeter();
    syncButtons(false);
    status.textContent = tracks[index].title + ' selected';
    if (wasPlaying) await start();
  }

  playButton.addEventListener('click', () => {
    if (playButton.classList.contains('is-playing')) pause();
    else start();
  });
  prevButton.addEventListener('click', () => changeTrack(-1));
  nextButton.addEventListener('click', () => changeTrack(1));
  muteButton.addEventListener('click', () => {
    muted = !muted;
    fadeTo(targetVolume(), .16);
    syncButtons(playButton.classList.contains('is-playing'));
    status.textContent = muted ? 'Music muted' : 'Sound restored';
  });
  volumeInput.addEventListener('input', () => {
    volume = Number(volumeInput.value);
    if (volume > 0) muted = false;
    if (volume === 0) muted = true;
    fadeTo(targetVolume(), .08);
    syncButtons(playButton.classList.contains('is-playing'));
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) idleMeter();
    else if (!audio.paused && !meterFrame) animateMeter();
  });
  syncButtons(false);
})();
