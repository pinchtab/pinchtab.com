export type DocsConfig = Record<string, string | string[]>;

export interface DocsManifestItem {
  slug: string;
  title: string;
  sourcePath: string;
}

export interface DocsManifestSection {
  id: string;
  label: string;
  items: DocsManifestItem[];
}

export interface DocsPageHeading {
  depth: number;
  slug: string;
  text: string;
}

export type ContentBlock = 
  | { type: 'html'; html: string }
  | { type: 'terminal'; agent: string; human: string; response?: string }
  | { type: 'diagram'; content: string; format: 'ascii' | 'mermaid' };

export interface DocsPage extends DocsManifestItem {
  sectionId: string;
  sectionLabel: string;
  content: string;
  html: string;
  blocks: ContentBlock[];
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

export interface ApiReferenceEndpoint {
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
