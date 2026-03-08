import fs from 'node:fs';
import path from 'node:path';
import type { 
  DocsConfig, 
  DocsData, 
  DocsPage, 
  DocsManifestItem, 
  DocsManifestSection,
  ContentBlock 
} from './types';
import { 
  DOCS_BRANCH, 
  DOCS_JSON_URL, 
  LOCAL_DOCS_PATH, 
  TEMP_SKIPPED_DOCS, 
  USE_LOCAL_DOCS 
} from './config';
import { 
  normalizeSourcePath, 
  sectionLabel, 
  titleFromMarkdown, 
  makeUniqueSlug, 
  slugFromPath 
} from './utils';
import { isApiReferenceJson, buildApiReferenceMarkdown } from './api-reference';
import { 
  transformDocsCodeBlocks, 
  transformDocsTables, 
  transformDocsImageSources,
  transformDocsInternalLinks
} from './transformers';
import { getMarkdownProcessor } from './markdown';

const SUPPORTED_DOC_EXTENSIONS = new Set(['.json', '.markdown', '.md', '.mdx']);

export function isTemporarilySkippedDoc(sourcePath: string): boolean {
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

function isDirectoryWildcardEntry(sourcePath: string): boolean {
  return sourcePath === '*' || sourcePath.endsWith('/*');
}

function resolveWildcardDirectory(sectionId: string, sourcePath: string): string {
  if (sourcePath === '*') {
    return normalizeSourcePath(sectionId);
  }

  return normalizeSourcePath(sourcePath.slice(0, -2));
}

function isSupportedDocFile(sourcePath: string): boolean {
  return SUPPORTED_DOC_EXTENSIONS.has(path.extname(sourcePath).toLowerCase());
}

function sortExpandedSourcePaths(sourcePaths: string[], folderPath: string): string[] {
  const landingPagePath = normalizeSourcePath(path.posix.join(folderPath, 'index.md'));

  return [...sourcePaths].sort((left: string, right: string) => {
    if (left === landingPagePath) {
      return -1;
    }
    if (right === landingPagePath) {
      return 1;
    }

    return left.localeCompare(right);
  });
}

function mapRepoPathToSourcePath(repoPath: string, docsRoot: string): string {
  const normalizedRepoPath = normalizeSourcePath(repoPath);
  const normalizedDocsRoot = normalizeSourcePath(docsRoot);
  const docsPrefix = `${normalizedDocsRoot}/`;

  if (normalizedRepoPath === normalizedDocsRoot) {
    return '';
  }

  if (normalizedRepoPath.startsWith(docsPrefix)) {
    return normalizedRepoPath.slice(docsPrefix.length);
  }

  return normalizedRepoPath;
}

function resolveDirectoryRepoPathCandidates(folderPath: string, docsRoot: string): string[] {
  const normalizedFolderPath = normalizeSourcePath(folderPath);
  const normalizedDocsRoot = normalizeSourcePath(docsRoot);

  const candidates = [
    `${normalizedDocsRoot}/${normalizedFolderPath}`,
    normalizedFolderPath,
  ];

  return candidates.filter((candidate, index) => candidates.indexOf(candidate) === index);
}

function listDocsInLocalDirectory(folderPath: string): string[] {
  const localCandidates = [
    path.join(LOCAL_DOCS_PATH, folderPath),
    path.join(path.dirname(LOCAL_DOCS_PATH), folderPath),
  ];

  for (const localPath of localCandidates) {
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isDirectory()) {
      continue;
    }

    const directoryEntries = fs.readdirSync(localPath, { withFileTypes: true }) as Array<{
      isFile(): boolean;
      name: string;
    }>;
    const sourcePaths: string[] = [];

    for (const entry of directoryEntries) {
      if (!entry.isFile() || entry.name.startsWith('.') || !isSupportedDocFile(entry.name)) {
        continue;
      }

      sourcePaths.push(normalizeSourcePath(path.posix.join(folderPath, entry.name)));
    }

    return sortExpandedSourcePaths(sourcePaths, folderPath);
  }

  throw new Error(`Local docs directory not found for "${folderPath}". Candidates:\n${localCandidates.join('\n')}`);
}

interface GitHubDocsLocation {
  owner: string;
  repo: string;
  branch: string;
  docsRoot: string;
}

function parseGitHubDocsLocation(docsJsonUrl: string): GitHubDocsLocation | null {
  try {
    const url = new URL(docsJsonUrl);
    if (url.hostname !== 'raw.githubusercontent.com') {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 6 || segments[2] !== 'refs' || segments[3] !== 'heads') {
      return null;
    }

    const owner = segments[0];
    const repo = segments[1];
    const indexJsonPosition = segments.lastIndexOf('index.json');
    if (!owner || !repo || indexJsonPosition === -1 || indexJsonPosition <= 4) {
      return null;
    }

    const branch = segments.slice(4, indexJsonPosition - 1).join('/');
    const docsRoot = segments[indexJsonPosition - 1];
    if (!branch || !docsRoot) {
      return null;
    }

    return { owner, repo, branch, docsRoot };
  } catch {
    return null;
  }
}

async function listDocsInGitHubDirectory(docsJsonUrl: string, folderPath: string): Promise<string[]> {
  const location = parseGitHubDocsLocation(docsJsonUrl);
  if (!location) {
    throw new Error(`Wildcard docs entries require local docs or a raw.githubusercontent.com index.json URL. Received: ${docsJsonUrl}`);
  }

  const attempts: string[] = [];

  for (const repoPath of resolveDirectoryRepoPathCandidates(folderPath, location.docsRoot)) {
    const contentsUrl = `https://api.github.com/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}/contents/${encodePath(repoPath)}?ref=${encodeURIComponent(location.branch)}`;
    const response = await fetch(contentsUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      attempts.push(`${contentsUrl} -> ${response.status} ${response.statusText}`);
      continue;
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      attempts.push(`${contentsUrl} -> invalid directory payload`);
      continue;
    }

    return sortExpandedSourcePaths(
      payload
      .filter((entry): entry is { type: string; path: string } => {
        return Boolean(entry) &&
          typeof entry === 'object' &&
          'type' in entry &&
          'path' in entry &&
          typeof entry.type === 'string' &&
          typeof entry.path === 'string' &&
          entry.type === 'file' &&
          isSupportedDocFile(entry.path);
      })
      .map((entry) => mapRepoPathToSourcePath(entry.path, location.docsRoot)),
      folderPath
    );
  }

  throw new Error(`Failed to list docs directory "${folderPath}". Attempts:\n${attempts.join('\n')}`);
}

async function expandDocSourceEntry(
  sectionId: string,
  rawSourcePath: string,
  docsJsonUrl: string
): Promise<string[]> {
  const sourcePath = normalizeSourcePath(rawSourcePath);
  if (!isDirectoryWildcardEntry(sourcePath)) {
    return [sourcePath];
  }

  const folderPath = resolveWildcardDirectory(sectionId, sourcePath);

  return USE_LOCAL_DOCS
    ? listDocsInLocalDirectory(folderPath)
    : listDocsInGitHubDirectory(docsJsonUrl, folderPath);
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

export async function fetchDocFromCandidates(
  docsBaseUrl: string,
  repoBaseUrl: string,
  sourcePath: string
): Promise<{ sourceUrl: string; content: string }> {
  const safePath = normalizeSourcePath(sourcePath);

  if (USE_LOCAL_DOCS) {
    const localCandidates = [
      path.join(LOCAL_DOCS_PATH, safePath),
      path.join(path.dirname(LOCAL_DOCS_PATH), safePath),
    ];

    for (const localPath of localCandidates) {
      if (fs.existsSync(localPath)) {
        console.log(`[docs] loading "${safePath}" from local file: ${localPath}`);
        return {
          sourceUrl: `file://${localPath}`,
          content: fs.readFileSync(localPath, 'utf-8'),
        };
      }
    }
    console.error(`[docs] local file not found for "${sourcePath}". Candidates:\n${localCandidates.join('\n')}`);
  }

  const candidates = resolveDocSourceCandidates(docsBaseUrl, repoBaseUrl, safePath);
  const attempts: string[] = [];

  for (const candidate of candidates) {
    const response = await fetch(candidate);
    if (response.ok) {
      console.log(`[docs] loading "${safePath}" from remote file: ${candidate}`);
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

export async function fetchDocsConfig(): Promise<{ config: DocsConfig; branch: string; docsJsonUrl: string; docsBaseUrl: string }> {
  if (USE_LOCAL_DOCS) {
    const localConfigPath = path.join(LOCAL_DOCS_PATH, 'index.json');
    if (fs.existsSync(localConfigPath)) {
      const parsed = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'));
      if (!isValidDocsConfig(parsed)) {
        throw new Error(`Invalid index.json schema at ${localConfigPath}`);
      }
      return {
        config: parsed,
        branch: 'local',
        docsJsonUrl: `file://${localConfigPath}`,
        docsBaseUrl: `file://${LOCAL_DOCS_PATH}/`,
      };
    }
  }

  console.log(`[docs] loading manifest from branch "${DOCS_BRANCH}": ${DOCS_JSON_URL}`);
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

function parseHtmlIntoBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const regex = /(?:<p>\s*)?\[\[BLOCK:(TERMINAL|DIAGRAM):(\{.*?\})\]\](?:\s*<\/p>)?/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    // Add HTML block before the match
    const before = html.substring(lastIndex, match.index).trim();
    if (before) {
      blocks.push({ type: 'html', html: before });
    }
    
    const type = match[1].toLowerCase() as 'terminal' | 'diagram';
    const payloadJson = match[2];
    
    try {
      const payload = JSON.parse(payloadJson);
      if (type === 'terminal') {
        blocks.push({ 
          type: 'terminal', 
          agent: payload.agent || '', 
          human: payload.human || '', 
          response: payload.response 
        });
      } else if (type === 'diagram') {
        blocks.push({ 
          type: 'diagram', 
          content: payload.content || '',
          format: payload.format === 'mermaid' ? 'mermaid' : 'ascii',
        });
      }
    } catch (e) {
      console.error(`[docs] failed to parse block payload: ${payloadJson}`, e);
    }
    
    lastIndex = regex.lastIndex;
  }
  
  const remaining = html.substring(lastIndex).trim();
  if (remaining) {
    blocks.push({ type: 'html', html: remaining });
  }
  
  return blocks;
}

export async function loadDocsFromRemote(): Promise<DocsData> {
  const markdownProcessor = await getMarkdownProcessor();
  const { config, branch, docsJsonUrl, docsBaseUrl } = await fetchDocsConfig();
  const repoBaseUrl = buildRepoBaseUrl(docsJsonUrl);

  console.log(`[docs] resolved docs source: branch=${branch} manifest=${docsJsonUrl}`);

  const seenSlugs = new Set<string>();
  const sourcePathToPage = new Map<string, DocsPage>();
  const sourcePathToSlug = new Map<string, string>();
  const sections: DocsManifestSection[] = [];

  // Pass 1: Discovery & Initial Render
  for (const [sectionId, entries] of Object.entries(config)) {
    const entryList = Array.isArray(entries) ? entries : [entries];
    const sectionItems: DocsManifestItem[] = [];
    const seenSectionSourcePaths = new Set<string>();

    for (const rawSourcePath of entryList) {
      try {
        const sourcePaths = await expandDocSourceEntry(sectionId, rawSourcePath, docsJsonUrl);

        for (const sourcePath of sourcePaths) {
          if (isTemporarilySkippedDoc(sourcePath) || seenSectionSourcePaths.has(sourcePath)) {
            continue;
          }

          seenSectionSourcePaths.add(sourcePath);

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
              html: rendered.code,
              blocks: [], // Populated in Pass 2
              headings: rendered.metadata.headings || [],
            };
            sourcePathToPage.set(sourcePath, page);
            sourcePathToSlug.set(sourcePath, slug);
          }

          sectionItems.push({
            slug: page.slug,
            title: page.title,
            sourcePath: page.sourcePath,
          });
        }
      } catch (error) {
        console.error(`[docs] failed to load page "${rawSourcePath}": ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

    if (sectionItems.length > 0) {
      sections.push({
        id: sectionId,
        label: sectionLabel(sectionId),
        items: sectionItems,
      });
    }
  }

  // Pass 2: Final Transformations
  for (const page of sourcePathToPage.values()) {
    const transformedHtml = transformDocsInternalLinks(
      transformDocsImageSources(
        transformDocsTables(transformDocsCodeBlocks(page.html)),
        page.sourceUrl
      ),
      sourcePathToSlug
    );

    page.html = transformedHtml;
    page.blocks = parseHtmlIntoBlocks(transformedHtml);
  }

  const pages = Array.from(sourcePathToPage.values());
  if (pages.length === 0) {
    throw new Error(`No documentation pages found in ${docsJsonUrl}`);
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
