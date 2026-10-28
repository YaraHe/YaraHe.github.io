import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.resolve(root, 'dist');
if (dist === root || !dist.startsWith(root + path.sep)) throw new Error('Unsafe build output path');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}
function write(relative, data) {
  const target = path.join(dist, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (relative.endsWith('.html') && !data.includes('rel="icon"')) data = data.replace('<head>', '<head><link rel="icon" href="data:,">');
  fs.writeFileSync(target, data);
}
function read(relative) { return fs.readFileSync(path.join(src, relative), 'utf8'); }
function bodyOf(html, segment) {
  const match = html.match(/<body>([\s\S]*?)<\/body>/i);
  if (!match) throw new Error(`Missing body in ${segment}`);
  return match[1].replaceAll('src="assets/', `src="${segment}/assets/`)
    .replace(/<main(?=\s|>)/, '<div').replace('</main>', '</div>');
}
function scopeCss(css, namespace) {
  const sheet = postcss.parse(css);
  sheet.walkRules(rule => {
    if (rule.parent?.name?.includes('keyframes')) return;
    rule.selectors = rule.selectors.map(selector => {
      const trimmed = selector.trim();
      if (trimmed === '*') return `.${namespace}, .${namespace} *`;
      if (trimmed === ':root' || trimmed === 'html' || trimmed === 'body') return `.${namespace}`;
      return `.${namespace} ${trimmed}`;
    });
  });
  return sheet.toString();
}

// Home keeps the approved implementation and visual assets; only prototype links change.
let home = read('home/index.html');
home = home.replace('Home — Editorial portfolio prototype', 'Home — Yara He')
  .replace('../Stage-4.1-Q1-Editorial-Overview/index.html', 'built/index.html')
  .replace('../Stage-5-What-I-Understand-Prototype/index.html', 'understand/index.html');
write('index.html', home);
for (const name of ['styles.css', 'reveal.js', 'music.js']) copy(path.join(src, 'home', name), path.join(dist, name));
for (const name of ['assets', 'audio']) copy(path.join(src, 'home', name), path.join(dist, name));

// One scrolling Onda Español case, with each approved composition scoped to its section.
const q1 = bodyOf(read('built/q1/index.html'), 'q1');
const q2 = bodyOf(read('built/q2/index.html'), 'q2');
const q3 = bodyOf(read('built/q3/index.html'), 'q3');
write('built/q1/styles.css', scopeCss(read('built/q1/styles.css'), 'q1'));
write('built/q2/styles.css', scopeCss(read('built/q2/styles.css'), 'q2'));
write('built/q3/styles.css', scopeCss(read('built/q3/styles.css'), 'q3'));
for (const name of ['q1-demo-cover-plate.png', 'onda-espanol-demo-native-crop-candidate.mp4']) {
  copy(path.join(src, 'built', 'q1', 'assets', name), path.join(dist, 'built', 'q1', 'assets', name));
}
copy(path.join(src, 'built', 'q1', 'demo.js'), path.join(dist, 'built', 'q1', 'demo.js'));
copy(path.join(src, 'built', 'q2', 'assets', 'practice-real-1170.png'), path.join(dist, 'built', 'q2', 'assets', 'practice-real-1170.png'));
copy(path.join(src, 'built', 'q3', 'assets'), path.join(dist, 'built', 'q3', 'assets'));
write('built/index.html', `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="onda-español：从真实的一句西语开始，理解、模仿并反复听熟。"><title>onda-español — What I Built</title><link rel="stylesheet" href="q1/styles.css"><link rel="stylesheet" href="q2/styles.css"><link rel="stylesheet" href="q3/styles.css"><link rel="stylesheet" href="../site.css"><script src="q1/demo.js" defer></script></head><body><nav class="site-nav" aria-label="全站导航"><a href="../index.html">Home</a><a href="index.html" aria-current="page">What I Built</a><a href="../understand/index.html">What I Understand</a><a href="../about/index.html">About Me</a></nav><main class="case-main"><section class="q1" id="overview" aria-label="项目概览">${q1}</section><section class="q2" id="experience" aria-label="示范与跟读">${q2}</section><section class="q3" id="feedback" aria-label="反馈与复练">${q3}</section></main></body></html>`);

// The knowledge index and all readers are regenerated from basic_learn Markdown.
copy(path.join(src, 'understand', 'styles.css'), path.join(dist, 'understand', 'styles.css'));
copy(path.join(src, 'understand', 'index.js'), path.join(dist, 'understand', 'index.js'));
copy(path.join(src, 'understand', 'assets', 'knowledge-map-reference.png'), path.join(dist, 'understand', 'assets', 'knowledge-map-reference.png'));
copy(path.join(src, 'understand', 'rag.js'), path.join(dist, 'understand', 'rag.js'));
copy(path.join(src, 'understand', 'assets', 'rag-paper-collage-handwritten.png'), path.join(dist, 'understand', 'assets', 'rag-paper-collage-handwritten.png'));
copy(path.join(src, 'understand', 'assets', 'voice-paper-collage-v2.png'), path.join(dist, 'understand', 'assets', 'voice-paper-collage-v2.png'));
copy(path.join(src, 'understand', 'assets', 'voice-flow-ink.svg'), path.join(dist, 'understand', 'assets', 'voice-flow-ink.svg'));
copy(path.join(src, 'understand', 'assets', 'NothingYouCouldDo.ttf'), path.join(dist, 'understand', 'assets', 'NothingYouCouldDo.ttf'));
copy(path.join(src, 'understand', 'assets', 'NothingYouCouldDo-OFL.txt'), path.join(dist, 'understand', 'assets', 'NothingYouCouldDo-OFL.txt'));
copy(path.join(src, 'about', 'styles.css'), path.join(dist, 'about', 'styles.css'));
copy(path.join(src, 'about', 'about.js'), path.join(dist, 'about', 'about.js'));
copy(path.join(src, 'about', 'assets'), path.join(dist, 'about', 'assets'));
write('site.css', read('site.css'));
const resumeIcon = `<svg class="about-link-icon" viewBox="0 0 36 36" aria-hidden="true"><path d="M6 2.5h15l9 9V33H6zM21 2.5V12h9M11 18h14M11 23h14M11 28h10"/></svg>`;
const resumeInner = `${resumeIcon}<span class="about-link-text"><strong><span data-lang="zh-CN">个人简历</span><span data-lang="en" hidden>Resume</span> <span aria-hidden="true">↗</span></strong><small data-lang="zh-CN">在线查看简历</small><small data-lang="en" hidden>View my resume</small></span>`;
const resumeReady = fs.existsSync(path.join(src, 'about', 'assets', 'resume.pdf'));
const resumeEntry = resumeReady
  ? `<a class="about-link" href="assets/resume.pdf" target="_blank" rel="noopener noreferrer" aria-label="在线查看何扬雯的简历 PDF" data-aria-zh="在线查看何扬雯的简历 PDF" data-aria-en="View Yara He's resume PDF">${resumeInner}</a>`
  : `<div class="about-link about-link-unavailable" aria-label="个人简历正在更新，暂无 PDF 链接" data-aria-zh="个人简历正在更新，暂无 PDF 链接" data-aria-en="Resume is being updated; no PDF available yet">${resumeIcon}<span class="about-link-text"><strong><span data-lang="zh-CN">个人简历</span><span data-lang="en" hidden>Resume</span></strong><small data-lang="zh-CN">正在更新</small><small data-lang="en" hidden>Being updated</small></span></div>`;
write('about/index.html', read('about/index.html').replace('{{RESUME_ENTRY}}', resumeEntry));
await import('./build-knowledge.mjs');
console.log(`Site built at ${dist}`);
