export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function decodeHtmlEntities(input: string): string {
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

export function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, '')).trim();
}

export function trimEmptyLines(lines: string[]): string[] {
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') {
    start++;
  }
  let end = lines.length - 1;
  while (end >= start && lines[end].trim() === '') {
    end--;
  }
  return lines.slice(start, end + 1);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugFromPath(sourcePath: string): string {
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

export function makeUniqueSlug(baseSlug: string, seen: Set<string>): string {
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

export function normalizeSourcePath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
  if (normalized.length === 0) {
    throw new Error('Navigation path cannot be empty');
  }
  if (normalized.split('/').includes('..')) {
    throw new Error(`Navigation path cannot contain "..": ${sourcePath}`);
  }
  return normalized;
}

export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

export function sectionLabel(sectionId: string): string {
  return sectionId
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function titleFromMarkdown(markdown: string, sourcePath: string): string {
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
