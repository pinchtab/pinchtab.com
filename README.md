# pinchtab.com

Marketing site for Pinchtab, built with Astro (static output) and Tailwind CSS v4.

## Stack

- Astro 5 (SSG)
- Tailwind CSS v4
- React (only where needed)
- Bun (dependency/runtime in CI and deploy workflows)

## Requirements

- Bun `>=1.0`
- Node.js `>=18` (for local tooling compatibility)

## Local Development

```bash
bun install
bun run dev
```

Open `http://localhost:4321`.

## Scripts

- `bun run dev` - start local dev server
- `bun run build` - production build to `dist/`
- `bun run preview` - preview production build
- `bun run type-check` - Astro type checks (`astro check`)

## Project Layout

- `src/components/ui` - reusable UI primitives
- `src/components/features` - page sections
- `src/components/layout` - base layout + footer
- `src/pages/index.astro` - homepage composition
- `public/` - static assets (`install.sh`, `rum.js`, manifest, icons, etc.)
- `.github/workflows/` - CI and deploy workflows

## CI and Deploy

### CI

Workflow: `.github/workflows/ci.yml`

Runs on push/PR to `main`:

1. `bun install --frozen-lockfile`
2. `bun run type-check`
3. `bun run build`

### Deploy

Workflow: `.github/workflows/deploy.yml`

Deploys to GitHub Pages on push to `main` after passing:

1. `bun install --frozen-lockfile`
2. `bun run type-check`
3. `bun run build`

## Notes

- Structured SEO metadata and JSON-LD are set in `src/components/layout/BaseLayout.astro`.
- AWS RUM loader is served from `public/rum.js`.
- Contributor card in the homepage fetches GitHub contributors at build time and filters excluded usernames.
