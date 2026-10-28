const filterButtons = [...document.querySelectorAll('[data-rag-filter]')];
const articleCards = [...document.querySelectorAll('[data-rag-group]')];
const resultStatus = document.querySelector('#rag-filter-status');

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    const selected = button.dataset.ragFilter;
    let visible = 0;
    for (const card of articleCards) {
      card.hidden = selected !== 'all' && card.dataset.ragGroup !== selected;
      if (!card.hidden) visible++;
    }
    for (const item of filterButtons) item.setAttribute('aria-pressed', String(item === button));
    resultStatus.textContent = `${button.dataset.label}：显示 ${visible} 篇笔记`;
  });
}
