# Cursor Rules — Pinchtab.com

## Project Stack
- **Astro 5.18+** (static SSG)
- **Tailwind CSS v4** (@tailwindcss/vite plugin)
- **TypeScript strict mode**
- **cva + cn()** for component variants

## Architecture Constraints

### Folder Organization
```
src/components/
  ├── ui/        # Atomic primitives (Button, Card, Badge)
  ├── layout/    # BaseLayout, Header, Footer
  └── features/  # Feature blocks (Hero, Features, etc.)
src/pages/       # Static .astro pages only
src/lib/         # utils.ts (cn helper)
src/styles/      # global.css (@import "tailwindcss")
```

### Component Rules

1. **UI Primitives** (src/components/ui/)
   - Use `cva` for all variants
   - Export `interface Props extends VariantProps<typeof xxxVariants>`
   - Always merge classes with `cn()`
   - Accept `class` prop for overrides
   - Single responsibility principle

   ```astro
   ---
   import { cva } from 'class-variance-authority';
   import { cn } from '@/lib/utils';
   
   const buttonVariants = cva('...', { variants: { ... } });
   export interface Props extends VariantProps<typeof buttonVariants> {
     class?: string;
   }
   ---
   ```

2. **Layout Components** (src/components/layout/)
   - BaseLayout imports global.css (once only)
   - Use semantic HTML: `<header>`, `<main>`, `<footer>`
   - Pass title/description for SEO
   - Provide `<slot />` for child content

3. **Feature Blocks** (src/components/features/)
   - Compose exclusively from ui/ primitives
   - Use `cn()` for conditional styling
   - Include semantic structure (section, h2, etc.)
   - Mobile-first responsive design

### CSS Rules

- **NO custom CSS files** (except global.css)
- **NO `<style>` blocks** in components
- **Use Tailwind utilities** everywhere
- **Brand colors**: `bg-brand-bg`, `text-brand-text`, `border-brand-border`, etc.
- **Custom utilities** via `@layer utilities` in global.css only

### TypeScript Rules

- Extend `astro/tsconfigs/strict` in tsconfig.json
- Use path aliases: `@/components`, `@/lib`, etc.
- Every component props must be typed
- No `any` types (except catch-all `[key: string]: any`)

## Common Patterns

### New Button Variant
```astro
---
import Button from '@/components/ui/Button.astro';
---

<Button variant="secondary" size="lg" href="/docs">
  Documentation
</Button>
```

### New Feature Block
```astro
---
import Card from '@/components/ui/Card.astro';
import Button from '@/components/ui/Button.astro';
---

<section id="new-feature" class="py-16 border-t border-brand-border">
  <Card variant="hover">
    <h3>Title</h3>
    <p>Content</p>
    <Button>CTA</Button>
  </Card>
</section>
```

### Conditional Classes
```astro
import { cn } from '@/lib/utils';

<div class={cn(
  'base classes',
  isActive && 'active-state',
  variant === 'dark' && 'bg-brand-surface'
)}>
```

## Before Committing

```bash
npm run build         # Must succeed, zero errors
npm run preview       # Verify locally
npm run type-check    # TypeScript strict
```

Then:
```bash
git add .
git commit -m "feat: add new section"
git push origin main  # Direct to main (no PRs during POC)
```

## Prohibited Patterns

❌ Do NOT:
- Create custom CSS files (use Tailwind only)
- Use `<style>` blocks in components
- Use `class` strings directly (must use `cn()`)
- Mix Tailwind + custom CSS
- Create components without TypeScript props
- Use `any` types without reason
- Commit without running `npm run build`

## Design Tokens

**Colors:** Use brand palette only
- bg: `#080b12`
- surface: `#0f1421`
- text: `#e2e8f4`
- accent: `#3b82f6`

**Typography:**
- sans: `Inter, system-ui, -apple-system, ...`
- mono: `JetBrains Mono, Fira Code, ...`

**Spacing:** Tailwind defaults (px, py, gap, etc.)

**Radius:** `rounded-sm` (6px), `rounded-md` (10px), `rounded-lg` (16px)

## Performance Targets

- Lighthouse 100/100 (performance, accessibility, best practices)
- Zero unused CSS
- <5KB gzipped JS (islands only if needed)
- <50KB HTML total
- No external fonts (system fonts only)

---

**Last Updated:** 2026-02-26
