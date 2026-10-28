const switchButtons = [...document.querySelectorAll('[data-switch-lang]')];
const translatedElements = [...document.querySelectorAll('[data-lang]')];
const translatedLabels = [...document.querySelectorAll('[data-aria-zh]')];
const emailAddress = document.getElementById('about-email-address');
const emailCopyButton = document.querySelector('.about-email-copy');
const emailFeedback = document.getElementById('about-email-feedback');
const copyLabelZh = emailCopyButton.querySelector('[data-lang="zh-CN"]');
const copyLabelEn = emailCopyButton.querySelector('[data-lang="en"]');
let feedbackTimer;

function resetEmailFeedback() {
  clearTimeout(feedbackTimer);
  copyLabelZh.textContent = '复制';
  copyLabelEn.textContent = 'Copy';
  emailFeedback.textContent = '';
}

function setLanguage(language) {
  document.documentElement.lang = language;
  document.title = language === 'en' ? 'About Me — Yara He' : 'About Me — 何扬雯';
  translatedElements.forEach(element => { element.hidden = element.dataset.lang !== language; });
  translatedLabels.forEach(element => { element.setAttribute('aria-label', language === 'en' ? element.dataset.ariaEn : element.dataset.ariaZh); });
  switchButtons.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.switchLang === language)); });
  resetEmailFeedback();
}

emailCopyButton.addEventListener('click', async () => {
  const address = emailAddress.textContent.trim();
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(address);
    clearTimeout(feedbackTimer);
    copyLabelZh.textContent = '已复制';
    copyLabelEn.textContent = 'Copied';
    emailFeedback.textContent = document.documentElement.lang === 'en' ? 'Email address copied.' : '邮箱地址已复制。';
    feedbackTimer = setTimeout(resetEmailFeedback, 3000);
  } catch {
    try {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(emailAddress);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch { /* The visible address remains selectable if selection is blocked. */ }
    resetEmailFeedback();
    emailFeedback.textContent = document.documentElement.lang === 'en'
      ? 'Copy failed. Please select the address above and copy it manually.'
      : '复制失败，请选中上方邮箱地址手动复制。';
  }
});

switchButtons.forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.switchLang)));
setLanguage('zh-CN');
