const switchButtons = [...document.querySelectorAll('[data-switch-lang]')];
const translatedElements = [...document.querySelectorAll('[data-lang]')];
const translatedLabels = [...document.querySelectorAll('[data-aria-zh]')];

function setLanguage(language) {
  document.documentElement.lang = language;
  document.title = language === 'en' ? 'About Me — Yara He' : 'About Me — 何扬雯';
  translatedElements.forEach(element => { element.hidden = element.dataset.lang !== language; });
  translatedLabels.forEach(element => { element.setAttribute('aria-label', language === 'en' ? element.dataset.ariaEn : element.dataset.ariaZh); });
  switchButtons.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.switchLang === language)); });
}

switchButtons.forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.switchLang)));
setLanguage('zh-CN');
