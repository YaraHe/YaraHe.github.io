import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const index = JSON.parse(fs.readFileSync(path.join(root, 'understand', 'article-index.json'), 'utf8'));
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
if (errors.length) throw new Error(`Broken or unsafe links:\n${errors.join('\n')}`);
const readerDir = path.join(root, 'understand', 'articles');
if (fs.readdirSync(readerDir).filter(name => name.endsWith('.html')).length !== 31) throw new Error('Reader count mismatch');
console.log(`Verified 31 readers, ${checkedLinks} local links, ${imageCount} image references, 16/12/3 categories.`);
