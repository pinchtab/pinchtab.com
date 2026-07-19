import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MarkdownHeading } from 'astro';
import { parse as parseYaml } from 'yaml';
import { getMarkdownProcessor } from '@/lib/docs/markdown';

export interface BlogPostSummary {
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  author: string;
  readTime: string;
  tags: string[];
  featured: boolean;
  draft: boolean;
  heroImage: string;
  ogImage: string;
}

export interface BlogPost extends BlogPostSummary {
  body: string;
  html: string;
  headings: MarkdownHeading[];
}

const blogDirectory = path.join(process.cwd(), 'src/content/blog');

function parseFrontmatter(source: string) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Blog post is missing frontmatter block.');
  }

  const [, rawFrontmatter, body] = match;
  const data = parseYaml(rawFrontmatter) as Record<string, unknown>;
  return { data, body };
}

function normalizePost(slug: string, data: Record<string, unknown>): BlogPostSummary {
  const pubDate = new Date(String(data.pubDate ?? ''));
  const updatedDate = data.updatedDate ? new Date(String(data.updatedDate)) : undefined;

  if (!data.title || !data.description || Number.isNaN(pubDate.getTime()) || !data.readTime) {
    throw new Error(`Blog post "${slug}" is missing required metadata.`);
  }

  return {
    slug,
    title: String(data.title),
    description: String(data.description),
    pubDate,
    updatedDate: updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate : undefined,
    author: String(data.author ?? 'PinchTab Agent'),
    readTime: String(data.readTime),
    tags: Array.isArray(data.tags) ? data.tags.map((tag) => String(tag)) : [],
    featured: Boolean(data.featured),
    draft: Boolean(data.draft),
    heroImage: String(data.heroImage ?? '/og-image.png'),
    ogImage: String(data.ogImage ?? data.heroImage ?? '/og-image.png'),
  };
}

async function readPostFile(fileName: string) {
  const source = await readFile(path.join(blogDirectory, fileName), 'utf8');
  const slug = path.basename(fileName, path.extname(fileName));
  const { data, body } = parseFrontmatter(source);
  const summary = normalizePost(slug, data);
  return { summary, body };
}

export async function getAllPosts() {
  const fileNames = await readdir(blogDirectory);
  const posts = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith('.md'))
      .map(async (fileName) => (await readPostFile(fileName)).summary)
  );

  return posts
    .filter((post) => !post.draft)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export async function getFeaturedPosts(limit = 3) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.featured).slice(0, limit);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const fileName = `${slug}.md`;
  const fileNames = await readdir(blogDirectory);
  if (!fileNames.includes(fileName)) {
    return undefined;
  }

  const { summary, body } = await readPostFile(fileName);
  if (summary.draft) {
    return undefined;
  }

  const markdownProcessor = await getMarkdownProcessor();
  const rendered = await markdownProcessor.render(body);

  return {
    ...summary,
    body,
    html: rendered.code,
    headings: rendered.metadata.headings,
  };
}
