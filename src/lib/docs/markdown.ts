import { createMarkdownProcessor, type MarkdownProcessor } from '@astrojs/markdown-remark';

let markdownProcessorPromise: Promise<MarkdownProcessor> | undefined;

export function getMarkdownProcessor(): Promise<MarkdownProcessor> {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor({
      syntaxHighlight: false,
    });
  }
  return markdownProcessorPromise;
}
