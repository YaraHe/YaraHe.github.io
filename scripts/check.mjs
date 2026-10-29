import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const index = JSON.parse(fs.readFileSync(path.join(root, 'understand', 'article-index.json'), 'utf8'));
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const htmlPath = value => value.split('/').map(encodeURIComponent).join('/');
const expected = { RAG: 16, 'Agent AI': 12, 'Voice Agent': 3 };
if (index.articles.length !== 31) throw new Error(`Expected 31 articles, found ${index.articles.length}`);
if (new Set(index.articles.map(item => item.id)).size !== 31) throw new Error('Duplicate article IDs');
for (const [category, count] of Object.entries(expected)) {
  if (index.articles.filter(item => item.category === category).length !== count) throw new Error(`Wrong ${category} count`);
}
let checkedLinks = 0;
let imageCount = 0;
const errors = [];
function visit(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) { visit(file); continue; }
    if (path.extname(file).toLowerCase() !== '.html') continue;
    const html = fs.readFileSync(file, 'utf8');
    for (const [, kind, raw] of html.matchAll(/\b(href|src)=["']([^"']+)["']/gi)) {
      if (/^(?:https?:|mailto:|data:|\/\/|#)/i.test(raw)) continue;
      const local = decodeURIComponent(raw.split(/[?#]/)[0].replaceAll('&amp;', '&'));
      if (!local) continue;
      const target = path.resolve(path.dirname(file), local);
      if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) errors.push(`${path.relative(root, file)} -> ${raw}`);
      checkedLinks++;
      if (kind.toLowerCase() === 'src' && /\.(?:png|jpe?g|webp|gif|svg)$/i.test(local)) imageCount++;
    }
    if (/file:\/\/|[A-Z]:\\Users\\HYW\\/i.test(html)) errors.push(`Local absolute path in ${path.relative(root, file)}`);
  }
}
visit(root);
const readerDir = path.join(root, 'understand', 'articles');
for (const article of index.articles) {
  const reader = fs.readFileSync(path.join(readerDir, `${article.id}.html`), 'utf8');
  const visibleTags = reader.match(/<div class="reader-tags">([\s\S]*?)<\/div>/)?.[1];
  const renderedTags = visibleTags ? [...visibleTags.matchAll(/<span>([\s\S]*?)<\/span>/g)].map(match => match[1]) : [];
  if (JSON.stringify(renderedTags) !== JSON.stringify(article.tags.map(escapeHtml))) errors.push(`Tag mismatch in ${article.id}`);
  const sourceLink = reader.match(/<a class="reader-source-link" href="([^"]+)" target="_blank" rel="noopener noreferrer">/);
  const sourceUrl = `https://github.com/YaraHe/basic_learn/blob/main/articles/${htmlPath(article.sourceRelativePath)}`;
  if (sourceLink?.[1] !== escapeHtml(sourceUrl)) errors.push(`Wrong GitHub source link in ${article.id}`);
}
if (errors.length) throw new Error(`Broken or unsafe links:\n${errors.join('\n')}`);
if (fs.readdirSync(readerDir).filter(name => name.endsWith('.html')).length !== 31) throw new Error('Reader count mismatch');
console.log(`Verified 31 readers, source links and complete tags; ${checkedLinks} local links, ${imageCount} image references, 16/12/3 categories.`);
