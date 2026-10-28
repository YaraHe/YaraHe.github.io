const STORAGE_KEY = 'what-i-understand-expanded-v1';
let saved = {};
try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); } catch { saved = {}; }

for (const button of document.querySelectorAll('[data-expand]')) {
  const chapter = button.dataset.expand;
  const section = document.getElementById(chapter);
  const extra = [...section.querySelectorAll('[data-extra]')];
  const total = section.querySelectorAll('.article-card').length;

  function apply(expanded, preserveButton = false) {
    extra.forEach(card => { card.hidden = !expanded; });
    button.setAttribute('aria-expanded', String(expanded));
    button.firstElementChild.textContent = expanded ? '收起文章' : `查看全部 ${total} 篇文章`;
    button.lastElementChild.textContent = expanded ? '↑' : '↓';
    section.classList.toggle('is-expanded', expanded);
    if (preserveButton) {
      button.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }

  apply(Boolean(saved[chapter]));
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    apply(expanded, !expanded);
    saved[chapter] = expanded;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* file preview may block storage */ }
  });
}
