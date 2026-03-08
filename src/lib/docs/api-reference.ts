import type { ApiReferenceEndpoint } from './types';
import { slugify, normalizeSourcePath } from './utils';

export function isApiReferenceJson(sourcePath: string): boolean {
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

export function buildApiReferenceMarkdown(jsonText: string, sourcePath: string): string {
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
