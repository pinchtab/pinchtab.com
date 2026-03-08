import type { DocsData } from './types';
import { loadDocsFromRemote } from './loader';

export * from './types';
export * from './config';
export * from './utils';
export * from './api-reference';
export * from './transformers';
export * from './markdown';
export * from './loader';

let docsPromise: Promise<DocsData> | undefined;

export function getDocsData(): Promise<DocsData> {
  if (!docsPromise) {
    docsPromise = loadDocsFromRemote();
  }
  return docsPromise;
}
