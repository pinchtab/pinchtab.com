import { escapeHtml, decodeHtmlEntities, stripHtmlTags, trimEmptyLines } from './utils';

function extractCodeLanguage(preAttrs: string, codeAttrs: string): string | null {
  const attrs = `${codeAttrs} ${preAttrs}`;
  const languageMatch = attrs.match(/\blanguage-([a-z0-9_-]+)/i) || attrs.match(/\bdata-language=["']?([a-z0-9_-]+)["']?/i);
  return languageMatch?.[1]?.toLowerCase() || null;
}

function isShellLanguage(language: string | null): boolean {
  return Boolean(language && /^(bash|sh|zsh|shell|console)$/.test(language));
}

function isMermaidLanguage(language: string | null): boolean {
  return language === 'mermaid';
}

function renderDocsTerminalCode(rawCode: string): string {
  const normalizedCode = rawCode.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  const lines = normalizedCode.split('\n');

  const cliIndex = lines.findIndex((l) => l.trim().startsWith('# CLI'));
  const responseIndex = lines.findIndex((l) => l.trim().startsWith('# Response'));

  let agentLines: string[] = [];
  let humanLines: string[] = [];
  let responseLines: string[] = [];

  if (cliIndex === -1 && responseIndex === -1) {
    agentLines = lines;
    humanLines = lines;
  } else if (cliIndex !== -1 && responseIndex === -1) {
    agentLines = lines.slice(0, cliIndex);
    humanLines = lines.slice(cliIndex + 1);
  } else if (cliIndex === -1 && responseIndex !== -1) {
    const cmd = lines.slice(0, responseIndex);
    agentLines = cmd;
    humanLines = cmd;
    responseLines = lines.slice(responseIndex + 1);
  } else {
    agentLines = lines.slice(0, cliIndex);
    humanLines = lines.slice(cliIndex + 1, responseIndex);
    responseLines = lines.slice(responseIndex + 1);
  }

  agentLines = trimEmptyLines(agentLines);
  humanLines = trimEmptyLines(humanLines);
  responseLines = trimEmptyLines(responseLines);

  const data = {
    agent: agentLines.join('\n').trim(),
    human: humanLines.join('\n').trim(),
    response: responseLines.join('\n').trim(),
  };

  return `[[BLOCK:TERMINAL:${JSON.stringify(data)}]]`;
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

function renderDocsDiagramCode(rawCode: string, format: 'ascii' | 'mermaid' = 'ascii'): string {
  const normalizedCode = rawCode.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  return `[[BLOCK:DIAGRAM:${JSON.stringify({ content: normalizedCode, format })}]]`;
}

export function transformDocsCodeBlocks(html: string): string {
  return html.replace(
    /<pre([^>]*)>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (full, preAttrs: string, codeAttrs: string, codeInner: string) => {
      const language = extractCodeLanguage(preAttrs, codeAttrs);
      const decoded = decodeHtmlEntities(codeInner);

      if (isMermaidLanguage(language)) {
        return renderDocsDiagramCode(decoded, 'mermaid');
      }

      if (looksLikeAsciiDiagram(decoded)) {
        return renderDocsDiagramCode(decoded);
      }

      if (isShellLanguage(language)) {
        return renderDocsTerminalCode(decoded);
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
          '<span class="inline-flex min-w-8 justify-center rounded-md border border-brand-red/35 bg-brand-red/12 px-2 py-1 text-[0.76rem] font-semibold uppercase tracking-[0.06em] text-brand-red">X</span>';
      } else if (value === '✓' || value === 'YES' || value === 'TRUE') {
        content =
          '<span class="inline-flex min-w-8 justify-center rounded-md border border-brand-green/35 bg-brand-green/15 px-2 py-1 text-[0.76rem] font-semibold uppercase tracking-[0.06em] text-brand-green">✓</span>';
      }
    }

    cellIndex += 1;
    return `<td class="${baseClass}">${content}</td>`;
  });
}

export function transformDocsTables(html: string): string {
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
      return `<tr class="border-t border-brand-border-subtle/15 transition-colors hover:bg-white/2">${styledCells}</tr>`;
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

export function transformDocsImageSources(html: string, sourceUrl: string): string {
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

export interface InternalLinkOptions {
  sourcePathToSlug: Map<string, string>;
  repoOwner: string;
  repoName: string;
}

export function transformDocsInternalLinks(html: string, options: InternalLinkOptions): string {
  const { sourcePathToSlug, repoOwner, repoName } = options;

  return html.replace(/href=(["'])([^"']+)\1/gi, (match, quote, href: string) => {
    if (/^(https?:\/\/|\/|#)/i.test(href)) {
      return match;
    }

    const [pathWithoutHash, hashFragment = ''] = href.split('#', 2);
    const hashSuffix = hashFragment ? `#${hashFragment}` : '';

    const cleanHref = pathWithoutHash.replace(/^\.\//, '');
    const hrefWithMd = cleanHref.endsWith('.md') ? cleanHref : cleanHref + '.md';

    if (sourcePathToSlug.has(hrefWithMd)) {
      return `href=${quote}/docs/${sourcePathToSlug.get(hrefWithMd)}${hashSuffix}${quote}`;
    }

    for (const [sourcePath, slug] of sourcePathToSlug.entries()) {
      if (sourcePath.endsWith(hrefWithMd)) {
        return `href=${quote}/docs/${slug}${hashSuffix}${quote}`;
      }
    }

    if (/\.md$/i.test(cleanHref)) {
      const docPath = cleanHref.startsWith('docs/') ? cleanHref : `docs/${cleanHref}`;
      const githubUrl = `https://github.com/${repoOwner}/${repoName}/blob/main/${docPath}${hashSuffix}`;
      return `href=${quote}${githubUrl}${quote} target=${quote}_blank${quote} rel=${quote}noopener noreferrer${quote}`;
    }

    return match;
  });
}
