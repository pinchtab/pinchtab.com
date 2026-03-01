import { createMarkdownProcessor, type MarkdownProcessor } from '@astrojs/markdown-remark';

type DocsConfig = Record<string, string | string[]>;

interface DocsManifestItem {
  slug: string;
  title: string;
  sourcePath: string;
}

interface DocsManifestSection {
  id: string;
  label: string;
  items: DocsManifestItem[];
}

export interface DocsPageHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface DocsPage extends DocsManifestItem {
  sectionId: string;
  sectionLabel: string;
  content: string;
  html: string;
  headings: DocsPageHeading[];
  sourceUrl: string;
}

export interface DocsData {
  name: string;
  branch: string;
  docsJsonUrl: string;
  sections: DocsManifestSection[];
  pages: DocsPage[];
  firstSlug: string | null;
}

const REPO_OWNER = 'pinchtab';
const REPO_NAME = 'pinchtab';
const DOCS_BRANCH = 'main';
const DOCS_JSON_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/refs/heads/${DOCS_BRANCH}/docs/index.json`;
const TEMP_SKIPPED_DOCS = new Set<string>([
  'references/api-reference.json',
]);

let docsPromise: Promise<DocsData> | undefined;
let markdownProcessorPromise: Promise<MarkdownProcessor> | undefined;

interface ApiReferenceEndpoint {
  method: string;
  path: string;
  html?: boolean;
  handler?: string;
  description?: string;
  tldr?: string;
  parameters?: string;
  payload?: string;
  curl?: boolean;
  cli?: boolean;
  curlExample?: string;
  cliExample?: string;
  examples?: unknown;
}

function getMarkdownProcessor(): Promise<MarkdownProcessor> {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor({
      syntaxHighlight: false,
    });
  }
  return markdownProcessorPromise;
}

function sectionLabel(sectionId: string): string {
  return sectionId
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function isApiReferenceJson(sourcePath: string): boolean {
  return normalizeSourcePath(sourcePath).toLowerCase().endsWith('references/api-reference.json');
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstStringFromUnknown(value: unknown): string | null {
  if (typeof value === 'string') {
    return asNonEmptyString(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const str = asNonEmptyString(entry);
      if (str) return str;
    }
  }
  return null;
}

function extractCurlExample(endpoint: ApiReferenceEndpoint): string | null {
  const direct = asNonEmptyString(endpoint.curlExample);
  if (direct) return direct;

  if (endpoint.examples && typeof endpoint.examples === 'object') {
    const fromExamples = firstStringFromUnknown((endpoint.examples as Record<string, unknown>).curl);
    if (fromExamples) return fromExamples;
  }

  return null;
}

function extractCliExample(endpoint: ApiReferenceEndpoint): string | null {
  const direct = asNonEmptyString(endpoint.cliExample);
  if (direct) return direct;

  if (endpoint.examples && typeof endpoint.examples === 'object') {
    const fromExamples = firstStringFromUnknown((endpoint.examples as Record<string, unknown>).cli);
    if (fromExamples) return fromExamples;
  }

  return null;
}

function normalizePayload(payload: string | null): string | null {
  if (!payload) return null;
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function buildPathAnchor(path: string): string {
  return slugify(path);
}

function pathGroupLabel(path: string): string {
  const firstPart = path.replace(/^\/+/, '').split('/')[0] || 'root';
  const clean = firstPart.replace(/[{}]/g, '').replace(/[-_]+/g, ' ').trim();
  if (!clean) return 'Root';
  return clean
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildApiReferenceMarkdown(jsonText: string, sourcePath: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid API reference payload in ${sourcePath}: expected JSON object`);
  }

  const maybeEndpoints = (parsed as { endpoints?: unknown }).endpoints;
  if (!Array.isArray(maybeEndpoints)) {
    throw new Error(`Invalid API reference payload in ${sourcePath}: "endpoints" must be an array`);
  }

  const endpoints = maybeEndpoints
    .map((entry): ApiReferenceEndpoint | null => {
      if (!entry || typeof entry !== 'object') return null;
      const method = (entry as { method?: unknown }).method;
      const path = (entry as { path?: unknown }).path;
      if (typeof method !== 'string' || typeof path !== 'string') return null;

      const endpoint: ApiReferenceEndpoint = {
        method: method.trim().toUpperCase(),
        path: path.trim(),
      };

      if (Boolean((entry as { html?: unknown }).html)) endpoint.html = true;

      const handler = asNonEmptyString((entry as { handler?: unknown }).handler);
      if (handler) endpoint.handler = handler;

      const description = asNonEmptyString((entry as { description?: unknown }).description);
      if (description) endpoint.description = description;

      const tldr = asNonEmptyString((entry as { tldr?: unknown }).tldr);
      if (tldr) endpoint.tldr = tldr;

      const parameters = asNonEmptyString((entry as { parameters?: unknown }).parameters);
      if (parameters) endpoint.parameters = parameters;

      const payload = asNonEmptyString((entry as { payload?: unknown }).payload);
      if (payload) endpoint.payload = payload;

      const curlExample = asNonEmptyString((entry as { curlExample?: unknown }).curlExample);
      if (curlExample) endpoint.curlExample = curlExample;

      const cliExample = asNonEmptyString((entry as { cliExample?: unknown }).cliExample);
      if (cliExample) endpoint.cliExample = cliExample;

      const examples = (entry as { examples?: unknown }).examples;
      if (examples !== undefined) endpoint.examples = examples;

      if (Boolean((entry as { curl?: unknown }).curl)) endpoint.curl = true;
      if (Boolean((entry as { cli?: unknown }).cli)) endpoint.cli = true;

      return endpoint;
    })
    .filter((entry): entry is ApiReferenceEndpoint => entry !== null);

  const sorted = endpoints
    .filter((endpoint) => !endpoint.html)
    .sort((a, b) => {
      const byPath = a.path.localeCompare(b.path);
      if (byPath !== 0) return byPath;
      return a.method.localeCompare(b.method);
    });

  const usedAnchors = new Set<string>();
  const pathAnchorMap = new Map<string, string>();
  for (const endpoint of sorted) {
    if (pathAnchorMap.has(endpoint.path)) continue;
    const baseAnchor = buildPathAnchor(endpoint.path);
    let anchor = baseAnchor;
    let suffix = 2;
    while (usedAnchors.has(anchor)) {
      anchor = `${baseAnchor}-${suffix}`;
      suffix += 1;
    }
    usedAnchors.add(anchor);
    pathAnchorMap.set(endpoint.path, anchor);
  }

  const grouped = new Map<string, Map<string, ApiReferenceEndpoint[]>>();
  for (const endpoint of sorted) {
    const group = pathGroupLabel(endpoint.path);
    let groupPaths = grouped.get(group);
    if (!groupPaths) {
      groupPaths = new Map<string, ApiReferenceEndpoint[]>();
      grouped.set(group, groupPaths);
    }

    const samePathEndpoints = groupPaths.get(endpoint.path) ?? [];
    samePathEndpoints.push(endpoint);
    groupPaths.set(endpoint.path, samePathEndpoints);
  }

  const indexRows = sorted
    .map((endpoint) => {
      const anchor = pathAnchorMap.get(endpoint.path) || buildPathAnchor(endpoint.path);
      return `| ${endpoint.method} | [${endpoint.path}](#${anchor}) | ${extractCliExample(endpoint) ? '✓' : 'X'} |`;
    })
    .join('\n');

  const detailBlocks: string[] = [];
  for (const [groupLabel, pathMap] of grouped) {
    detailBlocks.push(`## ${groupLabel}`);
    detailBlocks.push('');

    for (const [path, endpointsForPath] of pathMap) {
      const anchor = pathAnchorMap.get(path) || buildPathAnchor(path);
      detailBlocks.push(`### ${path}`);
      detailBlocks.push('');
      detailBlocks.push(`<a id="${anchor}"></a>`);
      detailBlocks.push('');

      for (const endpoint of endpointsForPath) {
        const curlExample = extractCurlExample(endpoint);
        const cliExample = extractCliExample(endpoint);
        const payload = normalizePayload(endpoint.payload || null);

        detailBlocks.push(`#### ${endpoint.method}`);
        detailBlocks.push('');

        if (endpoint.tldr) {
          detailBlocks.push(`**TL;DR:** ${endpoint.tldr}`);
          detailBlocks.push('');
        }
        if (endpoint.description && endpoint.description !== endpoint.tldr) {
          detailBlocks.push(endpoint.description);
          detailBlocks.push('');
        }

        const facts: string[] = [];
        if (endpoint.handler) facts.push(`- **Handler:** \`${endpoint.handler}\``);
        if (endpoint.parameters) facts.push(`- **Parameters:** ${endpoint.parameters}`);
        if (endpoint.curl || curlExample) facts.push('- **curl:** supported');
        if (cliExample) facts.push('- **CLI:** supported');
        if (facts.length > 0) {
          detailBlocks.push(...facts);
          detailBlocks.push('');
        }

        if (payload) {
          detailBlocks.push('##### Payload');
          detailBlocks.push('');
          detailBlocks.push('```json');
          detailBlocks.push(payload);
          detailBlocks.push('```');
          detailBlocks.push('');
        }

        if (curlExample) {
          detailBlocks.push('##### curl');
          detailBlocks.push('');
          detailBlocks.push('```bash');
          detailBlocks.push(curlExample);
          detailBlocks.push('```');
          detailBlocks.push('');
        }

        if (cliExample) {
          detailBlocks.push('##### CLI');
          detailBlocks.push('');
          detailBlocks.push('```bash');
          detailBlocks.push(cliExample);
          detailBlocks.push('```');
          detailBlocks.push('');
        }
      }
    }
  }

  return [
    '# API Reference',
    '',
    `Generated from \`${sourcePath}\` (${sorted.length} endpoints).`,
    '',
    '## Index',
    '',
    '| Method | Path | CLI |',
    '| --- | --- | --- |',
    indexRows,
    '',
    '## Endpoint Details',
    '',
    detailBlocks.join('\n'),
  ].join('\n');
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}

function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, '')).trim();
}

function extractCodeLanguage(preAttrs: string, codeAttrs: string): string | null {
  const attrs = `${codeAttrs} ${preAttrs}`;
  const languageMatch = attrs.match(/\blanguage-([a-z0-9_-]+)/i) || attrs.match(/\bdata-language=["']?([a-z0-9_-]+)["']?/i);
  return languageMatch?.[1]?.toLowerCase() || null;
}

function isShellLanguage(language: string | null): boolean {
  return Boolean(language && /^(bash|sh|zsh|shell|console)$/.test(language));
}

function isJsonLanguage(language: string | null): boolean {
  return Boolean(language && /^(json|jsonc|geojson)$/.test(language));
}

function renderDocsTerminalCode(rawCode: string): string {
  const normalizedCode = rawCode.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  const lines = normalizedCode.split('\n');
  const lineMarkup = lines
    .map((line) => {
      const isComment = line.trim().startsWith('#');
      return `<span class="block ${isComment ? 'text-brand-text-dim' : 'text-brand-accent'}" data-code-line data-is-comment="${
        isComment ? 'true' : 'false'
      }">${escapeHtml(line)}</span>`;
    })
    .join('');

  return `
<div class="my-6 overflow-hidden rounded-2xl border border-brand-border-subtle bg-brand-surface-code shadow-[0_0_40px_rgb(var(--brand-accent-rgb)/0.08)]" data-docs-terminal>
  <div class="flex h-12 items-center gap-4 border-b border-brand-border-subtle bg-[rgb(var(--brand-bg-rgb)/0.35)] px-5">
    <div class="flex gap-2">
      <span class="h-2.5 w-2.5 rounded-full bg-brand-red" aria-hidden="true"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-brand-accent" aria-hidden="true"></span>
      <span class="h-2.5 w-2.5 rounded-full bg-brand-green" aria-hidden="true"></span>
    </div>
    <span class="text-xs font-semibold uppercase tracking-[0.12em] text-brand-text-muted">bash</span>
    <span class="ml-auto text-xs uppercase tracking-[0.12em] text-brand-text-dim">terminal</span>
  </div>
  <div class="px-6 py-5">
    <pre class="code-terminal-section overflow-x-auto whitespace-pre font-mono text-[0.82rem] leading-[1.8] text-brand-text-muted m-0 border-0 bg-transparent p-0 text-left shadow-none">${lineMarkup}</pre>
  </div>
</div>`.trim();
}

function highlightJson(rawJson: string): string {
  const tokenRegex = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b/g;
  let highlighted = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(rawJson)) !== null) {
    highlighted += escapeHtml(rawJson.slice(cursor, match.index));
    const token = match[0];
    const tail = rawJson.slice(match.index + token.length);

    let className = 'text-brand-text-muted';
    if (token.startsWith('"')) {
      className = /^\s*:/.test(tail) ? 'text-brand-accent-light' : 'text-brand-green';
    } else if (token === 'true' || token === 'false') {
      className = 'text-brand-blue';
    } else if (token === 'null') {
      className = 'text-brand-red';
    } else {
      className = 'text-brand-accent';
    }

    highlighted += `<span class="${className}">${escapeHtml(token)}</span>`;
    cursor = match.index + token.length;
  }

  highlighted += escapeHtml(rawJson.slice(cursor));
  return highlighted;
}

function renderDocsJsonCode(rawCode: string): string {
  const normalizedCode = rawCode.replace(/\r\n/g, '\n').trim();
  let prettyJson = normalizedCode;

  try {
    prettyJson = JSON.stringify(JSON.parse(normalizedCode), null, 2);
  } catch {
    // Keep original content if the snippet is not strict JSON.
  }

  const highlightedJson = highlightJson(prettyJson);

  return `
<div class="my-6" data-docs-json>
  <pre class="code-terminal-section docs-json-pre overflow-x-auto whitespace-pre font-mono text-[0.82rem] leading-[1.75] text-brand-text-muted m-0 border-0 bg-transparent p-0 text-left shadow-none" data-json-code><code>${highlightedJson}</code></pre>
</div>`.trim();
}

function looksLikeAsciiDiagram(rawCode: string): boolean {
  const normalizedCode = rawCode.replace(/\r\n/g, '\n').trim();
  const lines = normalizedCode.split('\n');
  if (lines.length < 4) {
    return false;
  }

  const boxCharCount = (normalizedCode.match(/[┌┐└┘├┤┬┴┼│─═╔╗╚╝║]/g) || []).length;
  const arrowCount = (normalizedCode.match(/[↓↑←→]/g) || []).length;
  const commandLikeLines = lines.filter((line) =>
    /^\s*(curl|npm|pnpm|bun|node|go|git|docker|kubectl|python|pip|cd|ls|cp|mv|rm|cat|echo|export|sudo)\b/i.test(line)
  ).length;

  return (boxCharCount >= 6 || arrowCount >= 2) && commandLikeLines === 0;
}

function isDiagramConnector(char: string): boolean {
  return /[┌┐└┘├┤┬┴┼│─═╔╗╚╝║┆┄┈┉┊┋╭╮╯╰→←↑↓]/.test(char);
}

function renderDiagramLine(line: string): string {
  if (line.trim().length === 0) {
    return '<span class="block h-[1.45rem]"></span>';
  }

  const chars = Array.from(line);
  const styled = chars
    .map((char) => {
      if (char === ' ') {
        return ' ';
      }
      if (isDiagramConnector(char)) {
        return `<span class="text-brand-accent/70">${escapeHtml(char)}</span>`;
      }
      return `<span class="text-brand-text">${escapeHtml(char)}</span>`;
    })
    .join('');

  return `<span class="block px-2 py-0.5">${styled}</span>`;
}

function renderDocsDiagramCode(rawCode: string): string {
  const normalizedCode = rawCode.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  const lineMarkup = normalizedCode
    .split('\n')
    .map((line) => renderDiagramLine(line))
    .join('');

  return `
<figure class="my-7 overflow-hidden rounded-2xl border border-brand-border-subtle/30 bg-[linear-gradient(180deg,rgb(var(--brand-surface-rgb)/0.75),rgb(var(--brand-bg-rgb)/0.88))] shadow-[0_0_40px_rgb(var(--brand-accent-rgb)/0.08)]" data-docs-diagram>
  <figcaption class="flex items-center justify-between border-b border-brand-border-subtle/20 px-5 py-3">
    <span class="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-brand-text-dim">Architecture Diagram</span>
    <span class="text-[0.68rem] uppercase tracking-[0.12em] text-brand-text-dim">ASCII</span>
  </figcaption>
  <pre class="code-terminal-section overflow-x-auto whitespace-pre px-4 py-4 font-mono text-[0.81rem] leading-[1.58] m-0 border-0 bg-transparent text-left shadow-none sm:px-5 sm:py-5"><code>${lineMarkup}</code></pre>
</figure>`.trim();
}

function transformDocsCodeBlocks(html: string): string {
  return html.replace(
    /<pre([^>]*)>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (full, preAttrs: string, codeAttrs: string, codeInner: string) => {
      const language = extractCodeLanguage(preAttrs, codeAttrs);
      const decoded = decodeHtmlEntities(codeInner);

      if (looksLikeAsciiDiagram(decoded)) {
        return renderDocsDiagramCode(decoded);
      }

      if (isShellLanguage(language)) {
        return renderDocsTerminalCode(decoded);
      }

      if (isJsonLanguage(language)) {
        return renderDocsJsonCode(decoded);
      }

      return full;
    }
  );
}

function methodBadgeClass(method: string): string {
  switch (method) {
    case 'GET':
      return 'border border-brand-green/35 bg-brand-green/15 text-brand-green';
    case 'POST':
      return 'border border-brand-border bg-brand-accent-glow-bright text-brand-accent-light';
    case 'PUT':
    case 'PATCH':
      return 'border border-brand-blue/35 bg-brand-blue/12 text-brand-blue';
    case 'DELETE':
      return 'border border-brand-red/35 bg-brand-red/12 text-brand-red';
    default:
      return 'border border-brand-border-subtle/30 bg-white/5 text-brand-text-muted';
  }
}

function styleTableRowCells(rowHtml: string, isApiTable: boolean): string {
  let cellIndex = 0;

  return rowHtml.replace(/<td>([\s\S]*?)<\/td>/gi, (_, rawCell: string) => {
    const baseClass = 'px-4 py-3 text-sm text-brand-text-muted align-top';
    let content = rawCell.trim();

    if (isApiTable && cellIndex === 0) {
      const method = stripHtmlTags(content).toUpperCase();
      content = `<span class="inline-flex min-w-[3.1rem] justify-center rounded-md px-2 py-1 text-[0.76rem] font-semibold uppercase tracking-[0.06em] ${methodBadgeClass(
        method
      )}">${escapeHtml(method)}</span>`;
    } else if (isApiTable && cellIndex === 1) {
      const endpoint = stripHtmlTags(content);
      const hrefMatch = content.match(/href="([^"]+)"/i);
      if (endpoint.length > 0) {
        const endpointCode = `<code class="rounded bg-brand-accent-glow px-2 py-0.5 text-[0.76rem] text-brand-accent-light">${escapeHtml(
          endpoint
        )}</code>`;
        if (hrefMatch?.[1]) {
          const safeHref = hrefMatch[1].replace(/"/g, '&quot;');
          content = `<a href="${safeHref}" class="inline-flex transition hover:opacity-90">${endpointCode}</a>`;
        } else {
          content = endpointCode;
        }
      }
    } else if (isApiTable && cellIndex === 2) {
      const value = stripHtmlTags(content).toUpperCase();
      if (value === 'X') {
        content =
          '<span class="inline-flex min-w-[2rem] justify-center rounded-md border border-brand-red/35 bg-brand-red/12 px-2 py-1 text-[0.76rem] font-semibold uppercase tracking-[0.06em] text-brand-red">X</span>';
      } else if (value === '✓' || value === 'YES' || value === 'TRUE') {
        content =
          '<span class="inline-flex min-w-[2rem] justify-center rounded-md border border-brand-green/35 bg-brand-green/15 px-2 py-1 text-[0.76rem] font-semibold uppercase tracking-[0.06em] text-brand-green">✓</span>';
      }
    }

    cellIndex += 1;
    return `<td class="${baseClass}">${content}</td>`;
  });
}

function transformDocsTables(html: string): string {
  return html.replace(/<table>\s*<thead>([\s\S]*?)<\/thead>\s*<tbody>([\s\S]*?)<\/tbody>\s*<\/table>/gi, (_, theadInner: string, tbodyInner: string) => {
    const headers = Array.from(theadInner.matchAll(/<th>([\s\S]*?)<\/th>/gi)).map((match) => stripHtmlTags(match[1]).toLowerCase());
    const isApiTable = headers.length >= 2 && /method/.test(headers[0]) && /(endpoint|path)/.test(headers[1]);

    const styledThead = theadInner.replace(
      /<th>([\s\S]*?)<\/th>/gi,
      (_, rawHeader: string) =>
        `<th class="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-brand-text-dim">${rawHeader.trim()}</th>`
    );

    const styledTbody = tbodyInner.replace(/<tr>([\s\S]*?)<\/tr>/gi, (_, rawRow: string) => {
      const styledCells = styleTableRowCells(rawRow, isApiTable);
      return `<tr class="border-t border-brand-border-subtle/15 transition-colors hover:bg-white/[0.02]">${styledCells}</tr>`;
    });

    return `
<div class="my-7 overflow-x-auto rounded-2xl border border-brand-border-subtle/25 bg-[rgb(var(--brand-surface-rgb)/0.55)]">
  <table class="min-w-full border-collapse">
    <thead class="bg-[rgb(var(--brand-bg-rgb)/0.35)]">
      ${styledThead}
    </thead>
    <tbody>
      ${styledTbody}
    </tbody>
  </table>
</div>`.trim();
  });
}

function shouldResolveRelativeAssetUrl(url: string): boolean {
  const normalized = url.trim();
  if (normalized.length === 0) return false;
  if (normalized.startsWith('/')) return false;
  if (normalized.startsWith('#')) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(normalized)) return false;
  return true;
}

function resolveAssetUrl(url: string, sourceUrl: string): string {
  if (!shouldResolveRelativeAssetUrl(url)) {
    return url;
  }
  try {
    return new URL(url, sourceUrl).toString();
  } catch {
    return url;
  }
}

function transformDocsImageSources(html: string, sourceUrl: string): string {
  return html.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/\bsrc=(["'])([^"']+)\1/i);
    if (!srcMatch) {
      return imgTag;
    }

    const originalSrc = srcMatch[2];
    const resolvedSrc = resolveAssetUrl(originalSrc, sourceUrl);
    if (resolvedSrc === originalSrc) {
      return imgTag;
    }

    return imgTag.replace(srcMatch[0], `src="${resolvedSrc}"`);
  });
}

function titleFromMarkdown(markdown: string, sourcePath: string): string {
  const headingMatch = markdown.match(/^\s*#\s+(.+)\s*$/m);
  if (headingMatch?.[1]) {
    const cleanHeading = stripInlineMarkdown(headingMatch[1]);
    if (cleanHeading.length > 0) {
      return cleanHeading;
    }
  }

  const fileName = sourcePath.split('/').pop() || sourcePath;
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, '');
  const fallback = nameWithoutExtension.toLowerCase() === 'readme' ? 'Home' : nameWithoutExtension;
  return fallback
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugFromPath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
  const fileName = normalized.split('/').pop() ?? normalized;
  const stem = fileName.replace(/\.[^.]+$/, '');
  const base = slugify(stem);

  if (base === 'readme' || base.length === 0) {
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 1) {
      return 'home';
    }
    return slugify(parts[parts.length - 2]) || 'home';
  }

  return base;
}

function makeUniqueSlug(baseSlug: string, seen: Set<string>): string {
  if (!seen.has(baseSlug)) {
    seen.add(baseSlug);
    return baseSlug;
  }

  let suffix = 2;
  while (seen.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }
  const next = `${baseSlug}-${suffix}`;
  seen.add(next);
  return next;
}

function normalizeSourcePath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
  if (normalized.length === 0) {
    throw new Error('Navigation path cannot be empty');
  }
  if (normalized.split('/').includes('..')) {
    throw new Error(`Navigation path cannot contain "..": ${sourcePath}`);
  }
  return normalized;
}

function isTemporarilySkippedDoc(sourcePath: string): boolean {
  return TEMP_SKIPPED_DOCS.has(normalizeSourcePath(sourcePath).toLowerCase());
}

function encodePath(pathValue: string): string {
  return pathValue
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildRepoBaseUrl(docsJsonUrl: string): string {
  return docsJsonUrl.replace(/\/docs\/index\.json$/, '/');
}

function resolveDocSourceCandidates(docsBaseUrl: string, repoBaseUrl: string, sourcePath: string): string[] {
  if (/^https?:\/\//i.test(sourcePath)) {
    return [sourcePath];
  }

  const safePath = normalizeSourcePath(sourcePath);
  const candidates: string[] = [];

  // 1) Path relative to docs/ (default)
  candidates.push(`${docsBaseUrl}${encodePath(safePath)}`);

  // 2) Path relative to repository root (useful for README.md, etc.)
  candidates.push(`${repoBaseUrl}${encodePath(safePath)}`);

  // 3) If config already includes docs/ prefix, ensure repo-root resolution is attempted first-class.
  if (safePath.startsWith('docs/')) {
    candidates.push(`${repoBaseUrl}${encodePath(safePath)}`);
  }

  return candidates.filter((candidate, index) => candidates.indexOf(candidate) === index);
}

async function fetchDocFromCandidates(
  docsBaseUrl: string,
  repoBaseUrl: string,
  sourcePath: string
): Promise<{ sourceUrl: string; content: string }> {
  const candidates = resolveDocSourceCandidates(docsBaseUrl, repoBaseUrl, sourcePath);
  const attempts: string[] = [];

  for (const candidate of candidates) {
    const response = await fetch(candidate);
    if (response.ok) {
      return {
        sourceUrl: candidate,
        content: await response.text(),
      };
    }
    attempts.push(`${candidate} -> ${response.status} ${response.statusText}`);
  }

  throw new Error(`Failed to fetch "${sourcePath}". Attempts:\n${attempts.join('\n')}`);
}

function isValidDocsConfig(value: unknown): value is DocsConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every((entry) => {
    if (typeof entry === 'string') {
      return true;
    }
    return Array.isArray(entry) && entry.every((item) => typeof item === 'string');
  });
}

async function fetchDocsConfig(): Promise<{ config: DocsConfig; branch: string; docsJsonUrl: string; docsBaseUrl: string }> {
  const response = await fetch(DOCS_JSON_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${DOCS_JSON_URL} (${response.status} ${response.statusText})`);
  }

  const parsed = await response.json();
  if (!isValidDocsConfig(parsed)) {
    throw new Error(`Invalid index.json schema at ${DOCS_JSON_URL}`);
  }

  return {
    config: parsed,
    branch: DOCS_BRANCH,
    docsJsonUrl: DOCS_JSON_URL,
    docsBaseUrl: DOCS_JSON_URL.replace(/\/[^/]+$/, '/'),
  };
}

async function loadDocsFromRemote(): Promise<DocsData> {
  const markdownProcessor = await getMarkdownProcessor();
  const { config, branch, docsJsonUrl, docsBaseUrl } = await fetchDocsConfig();
  const repoBaseUrl = buildRepoBaseUrl(docsJsonUrl);

  const seenSlugs = new Set<string>();
  const sourcePathToPage = new Map<string, DocsPage>();
  const sections: DocsManifestSection[] = [];

  for (const [sectionId, entries] of Object.entries(config)) {
    const entryList = Array.isArray(entries) ? entries : [entries];
    const sectionItems: DocsManifestItem[] = [];

    for (const rawSourcePath of entryList) {
      const sourcePath = normalizeSourcePath(rawSourcePath);
      if (isTemporarilySkippedDoc(sourcePath)) {
        continue;
      }
      let page = sourcePathToPage.get(sourcePath);

      if (!page) {
        const { sourceUrl, content: rawContent } = await fetchDocFromCandidates(docsBaseUrl, repoBaseUrl, sourcePath);
        const content = isApiReferenceJson(sourcePath)
          ? buildApiReferenceMarkdown(rawContent, sourcePath)
          : rawContent;

        const rendered = await markdownProcessor.render(content);
        const title = titleFromMarkdown(content, sourcePath);
        const slug = makeUniqueSlug(slugFromPath(sourcePath), seenSlugs);

        page = {
          slug,
          title,
          sourcePath,
          sourceUrl,
          sectionId,
          sectionLabel: sectionLabel(sectionId),
          content,
          html: transformDocsImageSources(
            transformDocsTables(transformDocsCodeBlocks(rendered.code)),
            sourceUrl
          ),
          headings: rendered.metadata.headings || [],
        };
        sourcePathToPage.set(sourcePath, page);
      }

      sectionItems.push({
        slug: page.slug,
        title: page.title,
        sourcePath: page.sourcePath,
      });
    }

    if (sectionItems.length > 0) {
      sections.push({
        id: sectionId,
        label: sectionLabel(sectionId),
        items: sectionItems,
      });
    }
  }

  const pages = Array.from(sourcePathToPage.values());
  if (pages.length === 0) {
    throw new Error(`No documentation pages found in ${DOCS_JSON_URL}`);
  }

  const firstSlug = sections.flatMap((section) => section.items)[0]?.slug ?? null;
  return {
    name: 'PinchTab',
    branch,
    docsJsonUrl,
    sections,
    pages,
    firstSlug,
  };
}

export function getDocsData(): Promise<DocsData> {
  if (!docsPromise) {
    docsPromise = loadDocsFromRemote();
  }
  return docsPromise;
}
