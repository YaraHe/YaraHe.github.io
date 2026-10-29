import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';

// Source lives in the sibling basic_learn checkout; CONTENT_DIR can override it.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const here = path.join(projectRoot, 'dist', 'understand');
const sourceRoot = path.resolve(process.env.CONTENT_DIR ?? path.join(projectRoot, '..', 'basic_learn', 'articles'));
if (!fs.existsSync(sourceRoot)) throw new Error(`Article source is missing: ${sourceRoot}. Set CONTENT_DIR to a basic_learn articles directory.`);
marked.setOptions({ gfm: true, breaks: false });

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const htmlPath = value => value.split('/').map(encodeURIComponent).join('/');

function frontmatter(raw, sourcePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`Missing frontmatter: ${sourcePath}`);
  const block = match[1];
  function scalar(name) {
    const line = block.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))?.[1]?.trim();
    if (line === undefined) throw new Error(`Missing ${name}: ${sourcePath}`);
    if (line.startsWith('"')) return JSON.parse(line);
    return line;
  }
  const tagsBlock = block.match(/^tags:\s*\r?\n((?:\s+-\s+.*\r?\n?)+)/m)?.[1] ?? '';
  const tags = [...tagsBlock.matchAll(/^\s+-\s+(.+)$/gm)].map(match => {
    const value = match[1].trim();
    return value.startsWith('"') ? JSON.parse(value) : value;
  });
  const publishLine = block.match(/^publish:\s*(.*)$/m);
  const publishValue = publishLine?.[1].trim();
  if (publishLine && !['true', 'false'].includes(publishValue)) throw new Error(`Invalid publish value in ${sourcePath}; expected true or false.`);
  return { body: raw.slice(match[0].length), title: scalar('title'), description: scalar('description'), category: scalar('category'), subcategory: scalar('subcategory'), type: scalar('type'), status: scalar('status'), tags, publish: publishValue !== 'false' };
}

const chapters = [
  { key: 'RAG', id: 'rag', label: 'RAG', countLabel: '篇文章', description: '从资料进入知识库，到检索、生成与评估：追问回答依据从哪里来。' },
  { key: 'Agent Systems', id: 'agent', label: 'Agent AI', countLabel: '篇文章', description: '围绕工具、记忆、规划与协作，理解 Agent 怎样完成一项任务。' },
  { key: 'Voice Agent', id: 'voice', label: 'Voice Agent', countLabel: '篇文章', description: '把听、想、说连接起来，关注话轮、实时传输与响应延迟。' },
];

function idFor(relativePath) {
  const collection = relativePath.split('/')[0];
  const collectionId = ({ '实习·RAG-Portfolio-Content': 'rag', 'Agent-Memory-Portfolio-Content': 'memory', 'Agentic-AI-Portfolio-Content': 'agentic', 'Agent-Patterns-Portfolio-Content': 'patterns', 'Skill-Portfolio-Content': 'skill', 'MCP-Portfolio-Content': 'mcp', 'Voice-Agent-Portfolio-Content': 'voice' })[collection];
  if (!collectionId) throw new Error(`Unknown collection: ${collection}`);
  const base = path.basename(relativePath, '.md');
  const semantic = /^\d+-/.test(base) ? base.replace(/^\d+-/, '') : collectionId;
  return `${collectionId}-${semantic}`;
}

const topicDirectories = [
  '实习·RAG-Portfolio-Content/02-Topic-Articles',
  'Agentic-AI-Portfolio-Content/02-Topic-Articles',
  'Agent-Memory-Portfolio-Content/02-Topic-Articles',
];
const standaloneArticles = [
  'Agent-Patterns-Portfolio-Content/01-Final-Master/Agent-Patterns-完整学习笔记-Final.md',
  'Skill-Portfolio-Content/01-Final-Master/Skill-完整学习笔记-Final.md',
  'MCP-Portfolio-Content/01-Final-Master/MCP-完整学习笔记-Final.md',
];
const sourceFiles = [
  ...topicDirectories.flatMap(relativeDir => fs.readdirSync(path.join(sourceRoot, ...relativeDir.split('/')))
    .filter(name => name.endsWith('.md')).sort().map(name => `${relativeDir}/${name}`)),
  ...standaloneArticles,
  ...fs.readdirSync(path.join(sourceRoot, 'Voice-Agent-Portfolio-Content', '02-Final-Articles'))
    .filter(name => name.endsWith('.md')).sort().map(name => `Voice-Agent-Portfolio-Content/02-Final-Articles/${name}`),
];
const articles = sourceFiles.map(relativePath => {
  const sourcePath = path.join(sourceRoot, ...relativePath.split('/'));
  const raw = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
  const metadata = frontmatter(raw, sourcePath);
  const chapter = chapters.find(section => section.key === metadata.category);
  if (!chapter) throw new Error(`Unexpected category: ${metadata.category}`);
  const text = metadata.body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<[^>]*>/g, '').replace(/[\s#*`>|\[\]()_]/g, '');
  const readingTime = Math.max(1, Math.ceil(text.length / 450)); // Rough Chinese mixed-text estimate.
  return {
    id: idFor(relativePath), title: metadata.title, description: metadata.description,
    category: chapter.label, sourceCategory: metadata.category, subcategory: metadata.subcategory,
    tags: metadata.tags, readingTime, readingTimeEstimated: true,
    sourcePath, sourceRelativePath: relativePath, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
    status: metadata.status, publicReady: false, type: metadata.type, publish: metadata.publish, body: metadata.body,
  };
}).filter(article => article.publish);

// The four visible Agent AI entries sample different directions; the full set retains every source article.
const featuredAgentIds = [
  'agentic-agentic-ai-foundations',
  'agentic-tool-use',
  'memory-agent-memory-foundations',
  'agentic-planning',
];
const agentStart = articles.findIndex(article => article.sourceCategory === 'Agent Systems');
const agentCount = articles.filter(article => article.sourceCategory === 'Agent Systems').length;
const agentGroup = articles.slice(agentStart, agentStart + agentCount);
const featured = featuredAgentIds.map(id => {
  const article = agentGroup.find(item => item.id === id);
  if (!article) throw new Error(`Featured Agent AI article missing: ${id}`);
  return article;
});
articles.splice(agentStart, agentCount, ...featured, ...agentGroup.filter(article => !featuredAgentIds.includes(article.id)));

if (!articles.length || new Set(articles.map(article => article.id)).size !== articles.length) throw new Error('Article list is empty or IDs are duplicated; inspect source before rebuilding.');
fs.mkdirSync(path.join(here, 'articles'), { recursive: true });
fs.mkdirSync(path.join(here, 'assets'), { recursive: true });
const copiedAssets = new Set();

function rewriteLocalMedia(html, article) {
  return html.replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (whole, before, src, after) => {
    if (/^(https?:|data:|\/\/)/i.test(src)) return whole;
    const decoded = decodeURIComponent(src.split('#')[0].split('?')[0]);
    const sourceFile = path.resolve(path.dirname(article.sourcePath), decoded);
    const relative = path.relative(sourceRoot, sourceFile);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(sourceFile)) {
      console.warn(`Image unavailable in ${article.id}: ${src}`);
      return whole;
    }
    const destination = path.join(here, 'assets', relative);
    if (!copiedAssets.has(destination)) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(sourceFile, destination);
      copiedAssets.add(destination);
    }
    return `${before}../assets/${htmlPath(relative.replaceAll('\\', '/'))}${after}`;
  });
}

const articleBySourcePath = new Map(articles.map(article => [path.resolve(article.sourcePath).toLowerCase(), article]));
function rewriteArticleLinks(html, article) {
  return html.replace(/(<a\b[^>]*\bhref=["'])([^"']+)(["'][^>]*>)/gi, (whole, before, href, after) => {
    if (/^(https?:|mailto:|#|\/\/)/i.test(href)) return whole;
    const [target, fragment = ''] = href.split('#', 2);
    if (!/\.md$/i.test(target)) return whole;
    const decoded = decodeURIComponent(target.replaceAll('&amp;', '&'));
    const targetPath = path.resolve(path.dirname(article.sourcePath), decoded).toLowerCase();
    const linked = articleBySourcePath.get(targetPath);
    if (!linked) throw new Error(`Unresolved article link in ${article.id}: ${href}`);
    return `${before}${encodeURIComponent(linked.id)}.html${fragment ? `#${escapeHtml(fragment)}` : ''}${after}`;
  });
}

function renderBody(article) {
  let body = article.body.replace(/^\s*#\s+[^\r\n]+\r?\n/, ''); // Same H1 appears in reader masthead.
  const notes = [];
  body = body.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (_, key, value) => { notes.push({ key, value }); return ''; });
  const noteNumbers = new Map(notes.map((note, index) => [note.key, index + 1]));
  body = body.replace(/\[\^([^\]]+)\]/g, (whole, key) => noteNumbers.has(key) ? `<sup class="note-ref"><a href="#note-${escapeHtml(key)}">${noteNumbers.get(key)}</a></sup>` : whole);
  let html = marked.parse(body);
  if (notes.length) html += `<section class="reader-notes"><h2>参考与注释</h2><ol>${notes.map(note => `<li id="note-${escapeHtml(note.key)}">${marked.parseInline(note.value)}</li>`).join('')}</ol></section>`;
  return rewriteArticleLinks(rewriteLocalMedia(html, article), article);
}

function document(title, body, depth = 1) {
  const siteRoot = '../'.repeat(depth);
  const nav = `<nav class="site-nav" aria-label="全站导航"><a href="${siteRoot}index.html">Home</a><a href="${siteRoot}built/index.html">What I Built</a><a href="${siteRoot}understand/index.html" aria-current="page">What I Understand</a><a href="${siteRoot}about/index.html">About Me</a></nav>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><link rel="icon" href="data:,"><title>${escapeHtml(title)} — What I Understand</title><link rel="stylesheet" href="${siteRoot}site.css"><link rel="stylesheet" href="${siteRoot}understand/styles.css"></head><body>${nav}${body}</body></html>`;
}

function header(depth = 1) {
  return `<header class="page-head"><a class="site-name" href="${'../'.repeat(depth - 1)}index.html">What I Understand</a><span>Knowledge notes</span></header>`;
}

const entryIds = new Set(['rag-rag-overview', 'agentic-agentic-ai-foundations', 'voice-voice-agent-architecture-and-transport']);
function card(article, href = `../articles/${encodeURIComponent(article.id)}.html`) {
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  const redundant = new Set([article.category, article.sourceCategory, article.subcategory].map(normalize));
  const tag = article.tags.find(value => !redundant.has(normalize(value)) && !normalize(article.title).includes(normalize(value)));
  const subtopic = article.subcategory === 'Agentic AI' ? '' : article.subcategory;
  const label = subtopic || tag || article.subcategory;
  const extraLabel = entryIds.has(article.id) ? '<span class="start-here">从这里开始</span>' : (subtopic && tag ? `<span class="card-keyword">${escapeHtml(tag)}</span>` : '');
  return `<a class="article-card" href="${href}" aria-label="阅读：${escapeHtml(article.title)}"><div class="card-meta"><span class="card-subtopic">${escapeHtml(label)}</span>${extraLabel}</div><h3>${escapeHtml(article.title)}</h3><p class="card-description">${escapeHtml(article.description)}</p><div class="card-action"><span>约 ${article.readingTime} 分钟</span><span class="read-link"><span class="read-word">阅读全文</span><span class="read-arrow" aria-hidden="true">↗</span></span></div></a>`;
}

const dashboardCopy = {
  rag: { line: '让大模型连接真实世界的知识。', detail: '从基础概念到技术实现，梳理 RAG 的原理、检索方法、向量数据库与工程实践。' },
  agent: { line: '让大模型从“回答问题”到“完成任务”。', detail: '记录我对 Agent 的理解，包括核心概念、规划能力、工具使用和多智能体协作。' },
  voice: { line: '让 AI 通过语音，走进真实的使用场景。', detail: '整理语音交互的技术原理、语音大模型与对话系统的实践思考。' },
};
const topicIcon = {
  rag: '<path d="M12 20c-3-2-6-2-9-1V5c3-1 6-1 9 1m0 14c3-2 6-2 9-1V5c-3-1-6-1-9 1m0 0v14"/>',
  agent: '<rect x="10" y="2" width="4" height="4"/><rect x="2" y="17" width="5" height="5"/><rect x="17" y="17" width="5" height="5"/><path d="M12 6v6M4.5 17v-5H19.5v5"/>',
  voice: '<path d="M3 10v4m3-8v12m3-15v18m3-11v4m3-8v12m3-15v18m3-11v4m3-8v12"/>',
};
const icon = (shape, className = '') => `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
const fileIcon = icon('<path d="M5 2h9l5 5v15H5zM14 2v5h5M8 12h8M8 16h8"/>', 'note-icon');

const dashboardCards = chapters.map(chapter => {
  const group = articles.filter(article => article.sourceCategory === chapter.key);
  const preview = group.slice(0, 2).map(article => `<a class="preview-link" href="articles/${encodeURIComponent(article.id)}.html">${fileIcon}<span class="preview-text"><strong>${escapeHtml(article.title)}</strong><small>约 ${article.readingTime} 分钟阅读 · ${escapeHtml(article.subcategory)}</small></span><span class="preview-arrow" aria-hidden="true">→</span></a>`).join('');
  return `<section class="dashboard-card dashboard-card-${chapter.id}" aria-labelledby="${chapter.id}-title"><div class="dashboard-card-top"><span class="topic-sticker">${icon(topicIcon[chapter.id])}</span><div class="dashboard-card-heading"><h2 id="${chapter.id}-title">${chapter.label}</h2><p>${dashboardCopy[chapter.id].line}</p></div><span class="topic-count-info">${group.length} 篇笔记</span></div><p class="dashboard-card-detail">${dashboardCopy[chapter.id].detail}</p><div class="preview-list">${preview}</div><a class="dashboard-all" href="${chapter.id}/index.html">查看全部 ${group.length} 篇笔记 <span aria-hidden="true">→</span></a></section>`;
}).join('');

const dashboardHero = `<section class="dashboard-hero"><div class="dashboard-intro"><p class="dashboard-eyebrow">LEARNING, MADE SENSE OF</p><h1>把 AI 的知识，<br>变成真正理解的东西。</h1><p class="dashboard-description">这里记录我在学习 AI 过程中的思考、笔记与总结。<br>按主题整理成清晰的知识模块，既有概念梳理，也有实践理解，<br>帮助自己建立系统的认知，并持续在实践中加深理解。</p><p class="dashboard-thesis">少一些碎片，多一些结构；少一些记忆，多一些理解。</p></div><div class="knowledge-art" role="img" aria-label="纸张拼贴的 AI 知识关系图：RAG、Agent AI 与 Voice Agent 围绕 AI Learning Notes"><img src="assets/knowledge-map-reference.png" alt="" width="1536" height="1024"></div></section>`;
const indexHtml = document('AI 知识学习仪表盘', `<div class="page dashboard-page">${header()}<main>${dashboardHero}<div class="dashboard-grid" aria-label="知识主题">${dashboardCards}</div></main></div>`);
fs.writeFileSync(path.join(here, 'index.html'), indexHtml);

// Editorial filter groups organize the source subcategories without changing Markdown metadata.
const ragFilterDefinitions = [
  { id: 'foundation', label: '基础与数据', subcategories: ['RAG Fundamentals', 'Chunking', 'Vector Search'] },
  { id: 'retrieval', label: '检索与排序', subcategories: ['Keyword Retrieval', 'Hybrid Retrieval', 'Query Processing', 'Reranking'] },
  { id: 'generation', label: '生成与提示', subcategories: ['LLM Generation', 'Model Selection', 'Prompting and Context'] },
  { id: 'evaluation', label: '评估与实践', subcategories: ['Retrieval Evaluation', 'Answer Evaluation', 'Production RAG'] },
  { id: 'advanced', label: '扩展应用', subcategories: ['Agentic RAG', 'RAG and Fine-Tuning', 'Multimodal RAG'] },
];
const ragGroupBySubcategory = new Map();
for (const definition of ragFilterDefinitions) {
  for (const subcategory of definition.subcategories) {
    if (ragGroupBySubcategory.has(subcategory)) throw new Error(`Duplicate RAG filter mapping: ${subcategory}`);
    ragGroupBySubcategory.set(subcategory, definition.id);
  }
}

function ragTopicPage(group) {
  const diagramInk = fs.readFileSync(path.join(projectRoot, 'src', 'understand', 'assets', 'rag-flow-ink-handwritten.svg'), 'utf8')
    .replace('<svg ', '<svg class="rag-flow-ink" aria-hidden="true" focusable="false" ');
  const filterId = article => ragGroupBySubcategory.get(article.subcategory) ?? 'other';
  const filters = [...ragFilterDefinitions];
  if (group.some(article => filterId(article) === 'other')) filters.push({ id: 'other', label: '其他', subcategories: [] });
  const filterButtons = [
    `<button type="button" class="rag-filter" data-rag-filter="all" data-label="全部" aria-pressed="true">全部 <span>${group.length}</span></button>`,
    ...filters.map(filter => {
      const count = group.filter(article => filterId(article) === filter.id).length;
      return `<button type="button" class="rag-filter" data-rag-filter="${filter.id}" data-label="${filter.label}" aria-pressed="false">${filter.label} <span>${count}</span></button>`;
    }),
  ].join('');
  const cards = group.map(article => {
    const normalizedSubcategory = article.subcategory.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    const tag = article.tags.find(value => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '') !== normalizedSubcategory);
    return `<a class="rag-article" data-rag-group="${filterId(article)}" href="../articles/${encodeURIComponent(article.id)}.html" aria-label="阅读：${escapeHtml(article.title)}"><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.description)}</p><div class="rag-article-meta"><span>${escapeHtml(article.subcategory)}</span>${tag ? `<span>${escapeHtml(tag)}</span>` : ''}</div><span class="rag-article-arrow" aria-hidden="true">→</span></a>`;
  }).join('');
  const crumb = `<header class="page-head rag-page-head"><div><a href="../index.html">What I Understand</a><span aria-hidden="true"> / </span><span>RAG</span></div><span>RAG / Knowledge notes</span></header>`;
  const diagramAlt = 'RAG 流程：文档资料经过解析、分块与向量化写入向量数据库；用户问题触发检索，检索使用向量数据库返回相关文档片段；用户问题与片段组成增强提示，再生成回答。';
  const hero = `<section class="rag-hero"><div class="rag-intro"><h1 class="rag-title">RAG <span>/</span> ${group.length} 篇笔记</h1><p class="rag-summary">RAG 的核心概念、检索增强、向量数据库与工程实践。</p><div class="rag-filters" role="group" aria-label="按主题筛选 RAG 笔记">${filterButtons}</div><p id="rag-filter-status" class="rag-visually-hidden" role="status" aria-live="polite">全部：显示 ${group.length} 篇笔记</p></div><div class="rag-diagram rag-handwritten-diagram" role="img" aria-label="${diagramAlt}"><img src="../assets/rag-paper-collage-handwritten.png" alt="" width="1864" height="843">${diagramInk}</div></section>`;
  return `<div class="page rag-page">${crumb}<main>${hero}<div class="rag-section-rule" aria-hidden="true"></div><section class="rag-article-grid" aria-label="RAG 全部文章">${cards}</section><footer class="rag-footer"><a href="../index.html">← 返回 AI 知识学习仪表盘</a></footer></main></div><script src="../rag.js" defer></script>`;
}

function voiceTopicPage(group) {
  const diagramInk = fs.readFileSync(path.join(projectRoot, 'src', 'understand', 'assets', 'voice-flow-ink.svg'), 'utf8')
    .replace('<svg ', '<svg class="voice-flow-ink" aria-hidden="true" focusable="false" ');
  // Each filter is one actual Front Matter subcategory; the count follows the source files.
  const subcategories = [...new Set(group.map(article => article.subcategory))];
  const filterId = article => `voice-${subcategories.indexOf(article.subcategory)}`;
  const filterButtons = [
    `<button type="button" class="rag-filter" data-rag-filter="all" data-label="全部" aria-pressed="true">全部 <span>${group.length}</span></button>`,
    ...subcategories.map((subcategory, index) => `<button type="button" class="rag-filter" data-rag-filter="voice-${index}" data-label="${escapeHtml(subcategory)}" aria-pressed="false">${escapeHtml(subcategory)} <span>${group.filter(article => article.subcategory === subcategory).length}</span></button>`),
  ].join('');
  const cards = group.map(article => {
    const normalizedSubcategory = article.subcategory.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    const tag = article.tags.find(value => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '') !== normalizedSubcategory);
    return `<a class="rag-article" data-rag-group="${filterId(article)}" href="../articles/${encodeURIComponent(article.id)}.html" aria-label="阅读：${escapeHtml(article.title)}"><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.description)}</p><div class="rag-article-meta"><span>${escapeHtml(article.subcategory)}</span>${tag ? `<span>${escapeHtml(tag)}</span>` : ''}</div><span class="rag-article-arrow" aria-hidden="true">→</span></a>`;
  }).join('');
  const crumb = `<header class="page-head rag-page-head"><div><a href="../index.html">What I Understand</a><span aria-hidden="true"> / </span><span>Voice Agent</span></div><span>Voice Agent / Knowledge notes</span></header>`;
  const diagramAlt = 'Voice Agent 流程：用户语音经过语音识别进入 LLM 与对话管理，记忆和工具与对话管理双向交互；回复经语音合成后播放，实时对话和打断处理协调输入、对话状态与播放。';
  const hero = `<section class="rag-hero"><div class="rag-intro"><h1 class="rag-title">Voice Agent <span>/</span> ${group.length} 篇笔记</h1><p class="rag-summary">从语音交互的基本原理出发，梳理语音 Agent 的技术架构、关键技术与应用实践。</p><div class="rag-filters" role="group" aria-label="按主题筛选 Voice Agent 笔记">${filterButtons}</div><p id="rag-filter-status" class="rag-visually-hidden" role="status" aria-live="polite">全部：显示 ${group.length} 篇笔记</p></div><div class="rag-diagram voice-diagram" role="img" aria-label="${diagramAlt}"><img src="../assets/voice-paper-collage-v2.png" alt="" width="1774" height="887">${diagramInk}</div></section>`;
  return `<div class="page rag-page voice-page">${crumb}<main>${hero}<div class="rag-section-rule" aria-hidden="true"></div><section class="rag-article-grid" aria-label="Voice Agent 全部文章">${cards}</section><footer class="rag-footer"><a href="../index.html">← 返回 AI 知识学习仪表盘</a></footer></main></div><script src="../rag.js" defer></script>`;
}

function agentTopicPage(group) {
  const diagramInk = fs.readFileSync(path.join(projectRoot, 'src', 'understand', 'assets', 'agent-flow-ink.svg'), 'utf8')
    .replace('<svg ', '<svg class="agent-flow-ink" aria-hidden="true" focusable="false" ');
  // Keep every filter tied to the actual Markdown front-matter subcategory.
  const subcategories = [...new Set(group.map(article => article.subcategory))];
  const filterId = article => `agent-${subcategories.indexOf(article.subcategory)}`;
  const filterButtons = [
    `<button type="button" class="rag-filter" data-rag-filter="all" data-label="全部" aria-pressed="true">全部 <span>${group.length}</span></button>`,
    ...subcategories.map((subcategory, index) => `<button type="button" class="rag-filter" data-rag-filter="agent-${index}" data-label="${escapeHtml(subcategory)}" aria-pressed="false">${escapeHtml(subcategory)} <span>${group.filter(article => article.subcategory === subcategory).length}</span></button>`),
  ].join('');
  const leadingArticles = [
    'agentic-agentic-ai-foundations', 'agentic-planning', 'patterns-patterns',
    'agentic-tool-use', 'memory-agent-memory-foundations', 'agentic-evaluation',
  ];
  const orderedGroup = [...group].sort((a, b) => {
    const aRank = leadingArticles.indexOf(a.id);
    const bRank = leadingArticles.indexOf(b.id);
    return (aRank < 0 ? Infinity : aRank) - (bRank < 0 ? Infinity : bRank);
  });
  const cards = orderedGroup.map(article => {
    const normalizedSubcategory = article.subcategory.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    const tag = article.tags.find(value => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '') !== normalizedSubcategory);
    return `<a class="rag-article" data-rag-group="${filterId(article)}" href="../articles/${encodeURIComponent(article.id)}.html" aria-label="阅读：${escapeHtml(article.title)}"><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.description)}</p><div class="rag-article-meta"><span>${escapeHtml(article.subcategory)}</span>${tag ? `<span>${escapeHtml(tag)}</span>` : ''}</div><span class="rag-article-arrow" aria-hidden="true">→</span></a>`;
  }).join('');
  const crumb = `<header class="page-head rag-page-head"><div><a href="../index.html">What I Understand</a><span aria-hidden="true"> / </span><span>Agent AI</span></div><span>Agent AI / Knowledge notes</span></header>`;
  const diagramAlt = 'Agent 工作流程：用户目标进入规划与推理，经工具使用、执行与行动形成结果输出；记忆与上下文双向支持工具使用，结果通过观察、反馈与反思推动下一轮目标。';
  const hero = `<section class="rag-hero"><div class="rag-intro"><h1 class="rag-title">Agent AI <span>/</span> ${group.length} 篇笔记</h1><p class="rag-summary">从 AI Agent 的基本原理出发，梳理其技术架构、工具使用和多智能体协作等关键内容，记录我的理解与实践思考。</p><div class="rag-filters" role="group" aria-label="按主题筛选 Agent AI 笔记">${filterButtons}</div><p id="rag-filter-status" class="rag-visually-hidden" role="status" aria-live="polite">全部：显示 ${group.length} 篇笔记</p></div><div class="rag-diagram agent-diagram" role="img" aria-label="${diagramAlt}"><img src="../assets/voice-paper-collage-v2.png" alt="" width="1774" height="887">${diagramInk}</div></section>`;
  return `<div class="page rag-page agent-page">${crumb}<main>${hero}<div class="rag-section-rule" aria-hidden="true"></div><section class="rag-article-grid" aria-label="Agent AI 全部文章">${cards}</section><footer class="rag-footer"><a href="../index.html">← 返回 AI 知识学习仪表盘</a></footer></main></div><script src="../rag.js" defer></script>`;
}

// The three knowledge topics share a directory structure while keeping their own real Markdown content.
for (const chapter of chapters) {
  const group = articles.filter(article => article.sourceCategory === chapter.key);
  const topic = chapter.id === 'rag' ? ragTopicPage(group) : chapter.id === 'voice' ? voiceTopicPage(group) : agentTopicPage(group);
  const directory = path.join(here, chapter.id);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), document(chapter.label, topic, 2));
}

for (const article of articles) {
  const chapter = chapters.find(section => section.key === article.sourceCategory);
  const sourceUrl = `https://github.com/YaraHe/basic_learn/blob/main/articles/${htmlPath(article.sourceRelativePath)}`;
  const breadcrumb = `<header class="page-head reader-page-head"><nav class="reader-breadcrumb" aria-label="面包屑导航"><a href="../index.html">What I Understand</a><span aria-hidden="true"> / </span><a href="../${chapter.id}/index.html">${chapter.label}</a></nav><span>Knowledge notes</span></header>`;
  const reader = `<div class="page reader-page">${breadcrumb}<main class="reader"><div class="reader-rail"><span>约 ${article.readingTime} 分钟阅读 · 估算</span></div><header class="reader-head"><h1>${escapeHtml(article.title)}</h1><div class="reader-deck">${escapeHtml(article.description)}</div><div class="reader-tags">${article.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div><p class="reader-source"><a class="reader-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">在 GitHub 查看原文 <span aria-hidden="true">↗</span></a></p></header><article class="prose">${renderBody(article)}</article><footer class="reader-footer"><a href="../${chapter.id}/index.html">← 返回 ${chapter.label} 文章</a><a href="../index.html">AI 知识学习仪表盘</a></footer></main></div>`;
  fs.writeFileSync(path.join(here, 'articles', `${article.id}.html`), document(article.title, reader, 2));
}

const index = articles.map(({ body, sourcePath, publish, ...article }) => article);
const assetRecords = [...copiedAssets].sort().map(file => `${path.relative(here, file).replaceAll('\\', '/')}:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`);
const contentDigest = crypto.createHash('sha256').update([...index.map(article => `${article.sourceRelativePath}:${article.sourceSha256}`), ...assetRecords].join('\n')).digest('hex');
let contentCommit = null, contentDirty = null;
try {
  const checkout = path.dirname(sourceRoot);
  contentCommit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  contentDirty = Boolean(execFileSync('git', ['-C', checkout, 'status', '--porcelain'], { encoding: 'utf8' }).trim());
} catch { /* Standalone content export */ }
fs.writeFileSync(path.join(here, 'article-index.json'), JSON.stringify({ contentCommit, contentDirty, contentDigest, readingTimeMethod: '正文约 450 个混合字符/分钟向上取整，仅为估算', articles: index }, null, 2));
console.log(`Built ${articles.length} article pages and ${copiedAssets.size} local images.`);
