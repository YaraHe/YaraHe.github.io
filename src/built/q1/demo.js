const demo = document.querySelector('[data-demo]');

if (demo) {
  const video = demo.querySelector('.demo-video');
  const cover = demo.querySelector('.demo-cover');
  const status = demo.querySelector('.demo-status');
  const chapters = [...demo.querySelectorAll('.demo-chapters button')];
  const starts = chapters.map(button => Number(button.dataset.start));

  function updateChapter() {
    const time = video.currentTime || 0;
    const duration = Number.isFinite(video.duration) ? video.duration : 141.633;
    const active = Math.max(0, starts.findLastIndex(start => start <= time));
    chapters.forEach((button, index) => {
      const end = starts[index + 1] ?? duration;
      const progress = Math.max(0, Math.min(100, ((time - starts[index]) / (end - starts[index])) * 100));
      button.style.setProperty('--chapter-progress', `${progress}%`);
      button.classList.toggle('is-current', index === active);
      if (index === active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  function playFrom(time) {
    cover.hidden = true;
    video.controls = true;
    status.hidden = true;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) video.currentTime = time;
    else video.addEventListener('loadedmetadata', () => { video.currentTime = time; }, { once: true });
    const attempt = video.play();
    if (attempt) attempt.catch(() => {
      status.textContent = '视频暂时无法自动播放，请使用画面上的播放按钮重试。';
      status.hidden = false;
    });
  }

  cover.addEventListener('click', () => playFrom(0));
  chapters.forEach(button => button.addEventListener('click', () => playFrom(Number(button.dataset.start))));
  for (const event of ['loadedmetadata', 'timeupdate', 'seeked', 'ended']) video.addEventListener(event, updateChapter);
  video.addEventListener('error', () => {
    status.textContent = '视频暂时无法加载，请刷新页面后重试。';
    status.hidden = false;
  });
  updateChapter();
}
