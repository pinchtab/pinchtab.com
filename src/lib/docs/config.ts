import path from 'node:path';

export const REPO_OWNER = 'pinchtab';
export const REPO_NAME = 'pinchtab';
export const DOCS_BRANCH = 'main';
export const DOCS_JSON_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/refs/heads/${DOCS_BRANCH}/docs/index.json`;
export const TEMP_SKIPPED_DOCS = new Set<string>([
  'references/api-reference.json',
]);
export const USE_LOCAL_DOCS = false;
export const LOCAL_DOCS_PATH = path.resolve(process.cwd(), '../pt-bosch/docs');
