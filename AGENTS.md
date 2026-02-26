# Pinchtab.com — Agent Conventions & Architecture

## Overview
Astro 5.18+ static site (SSG) with **Tailwind CSS v4** + atomic components (cva-based). Zero runtime JavaScript by default. Islands architecture for any interactive features.

## Folder Structure

```
src/
├── components/
│   ├── ui/                 # Atomic primitives (Button, Card, Badge, Input, etc.)
│   │                       # Use cva + cn() for all variants
│   ├── layout/             # Page structure (BaseLayout, Header, Footer)
│   └── features/           # Page-specific feature blocks (Hero, Features, etc.)
├── lib/
│   └── utils.ts            # cn() helper for class merging
├── pages/
│   └── index.astro         # Static pages (NO .astro components in pages/)
├── styles/
│   └── global.css          # @import "tailwindcss" only
└── env.d.ts                # TypeScript definitions
```

## Component Patterns

### 1. UI Primitives (Atomic)
**Location:** `src/components/ui/`

Every UI primitive uses **class-variance-authority (cva)** for variants (except ModeSwitch, which uses inline JS for state).

#### ModeSwitch Component
Special component for human/agents toggle in top-right:
- Fixed positioning (`top-6 right-6`)
- Two buttons with icons (human + bot)
- Persists mode in localStorage
- Dispatches `modechange` custom event
- Styles with inline JS (for dynamic active state)

#### CodeTerminal Component
Reusable terminal code window with syntax highlighting:
- **File:** `src/components/ui/CodeTerminal.astro`
- **Props:**
  - `tabs: CodeTab[]` — array of `{ label, method, code }`
  - `defaultTab?: string` — which tab shows by default
  - `class?: string` — optional container classes
- **Features:**
  - macOS terminal styling (red/yellow/green dots)
  - Tab switching with yellow highlight
  - Copy button (yellow → green on copy)
  - Syntax coloring: comments in gray, commands in yellow
  - Responsive design

**Usage:**
```astro
import CodeTerminal from '@/components/ui/CodeTerminal.astro';

<CodeTerminal
  tabs={[
    { label: 'One-liner', method: 'oneliner', code: '# Comment\ncurl ...' },
    { label: 'npm', method: 'npm', code: '# Comment\nnpm install ...' },
  ]}
  defaultTab="oneliner"
/>
```

```astro
---
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2',
  {
    variants: {
      variant: {
        primary: '...',
        secondary: '...',
      },
      size: {
        sm: '...',
        md: '...',
        lg: '...',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface Props extends VariantProps<typeof buttonVariants> {
  href?: string;
  class?: string;
}

const { variant, size, class: className, ...rest } = Astro.props;
const buttonClass = cn(buttonVariants({ variant, size }), className);

const Component = href ? 'a' : 'button';
---

<Component class={buttonClass} {...rest}>
  <slot />
</Component>
```

**Rules:**
- Always use `cn()` to merge Tailwind + custom classes
- Accept `class` prop for overrides
- Provide TypeScript `Props` interface with `VariantProps<typeof xxxVariants>`
- Keep primitives **single-responsibility**

### 2. Layout Components
**Location:** `src/components/layout/`

Structure: `BaseLayout` → (Header, Footer) → `<slot />`

```astro
---
// BaseLayout.astro
import Header from './Header.astro';
import Footer from './Footer.astro';
import '@/styles/global.css';

export interface Props {
  title?: string;
  description?: string;
  class?: string;
}
---

<!doctype html>
<html lang="en">
  <head>...</head>
  <body class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

**Rules:**
- Import global.css **once** in BaseLayout
- Use semantic HTML (`<header>`, `<main>`, `<footer>`)
- Pass `title` and `description` for SEO

### 3. Feature Blocks
**Location:** `src/components/features/`

Feature blocks are **page-specific** UI sections. Compose from ui primitives.

```astro
---
// Hero.astro
import Button from '@/components/ui/Button.astro';
import Badge from '@/components/ui/Badge.astro';
import { cn } from '@/lib/utils';
---

<section class={cn('py-16', 'border-t border-brand-border')}>
  <Badge variant="accent">AI Native</Badge>
  <h1 class="text-4xl font-bold">...</h1>
  <Button variant="primary" href="...">CTA</Button>
</section>
```

**Rules:**
- Never use raw `<div>` — compose from ui primitives
- Use `cn()` for conditional classes
- Include semantic section tags + heading hierarchy
- Keep responsive via Tailwind breakpoints

## Tailwind + Color System

### Brand Colors (Tailwind extend)
```typescript
// tailwind.config.ts
colors: {
  brand: {
    bg: '#080b12',
    surface: '#0f1421',
    'surface-raised': '#151c2e',
    border: '#1e2d45',
    text: '#e2e8f4',
    'text-muted': '#7a8aaa',
    accent: '#3b82f6',
    'accent-bright': '#60a5fa',
    'accent-glow': 'rgba(59, 130, 246, 0.25)',
  },
}
```

### Usage
```astro
<div class="bg-brand-bg text-brand-text border border-brand-border">
  <button class="bg-brand-accent hover:bg-brand-accent-bright">
    Primary CTA
  </button>
</div>
```

**NO custom CSS** — use Tailwind utilities everywhere.

## TypeScript & Imports

### Path Aliases
```typescript
// tsconfig.json + astro.config.mjs
'@/*': ['src/*']
```

Usage:
```astro
import Button from '@/components/ui/Button.astro';
import { cn } from '@/lib/utils';
```

### Component Props
Every component should have a typed `Props` interface:

```astro
---
export interface Props {
  href?: string;
  variant?: 'primary' | 'secondary';
  class?: string;
  [key: string]: any; // catch-all for spread
}

const { href, variant = 'primary', class: className, ...rest } = Astro.props;
---
```

## CSS Rules

1. **No custom CSS in components** — use Tailwind utilities
2. **Global styles in `global.css` only:**
   - Base typography resets
   - Custom keyframe animations (if needed)
   - Layout utilities via `@layer utilities`
3. **Never use `<style>` blocks** in .astro files (except in islands)
4. **Dark mode:** Not needed — site is already dark theme (brand colors)

### Example: Custom utility
```css
/* src/styles/global.css */
@layer utilities {
  .container-custom {
    @apply w-full max-w-5xl mx-auto px-6 sm:px-8 lg:px-10;
  }
}
```

## Code Quality

### Before Committing
```bash
npm run build    # Must succeed with zero errors
npm run preview  # Verify static site locally
npm run type-check  # TypeScript strict mode
```

### Lint / Format
- Astro provides built-in formatting
- Use `astro check` for type checking

### Performance
- Lighthouse targets: **100/100 performance, accessibility, best practices**
- Zero unused CSS (Tailwind handles tree-shaking)
- Minimal JS via static Astro islands
- Image optimization with `<Image />` component

## Feature Checklist (for new sections)

When adding a new feature section:

- [ ] Create `.astro` file in `src/components/features/`
- [ ] Compose from ui/ primitives (Button, Card, Badge, etc.)
- [ ] Use `cn()` for class merging
- [ ] Add semantic HTML (section, h2/h3, etc.)
- [ ] Add responsive breakpoints (mobile-first)
- [ ] Test in dev: `npm run dev`
- [ ] Verify build: `npm run build`
- [ ] Commit to `main` (no PRs during POC phase)

## Useful Commands

```bash
# Development
npm run dev       # Local dev server + hot reload
npm run dev -- --host  # Expose to network

# Production
npm run build     # Build static site to dist/
npm run preview   # Preview production build locally

# Quality
npm run type-check  # TypeScript strict check
```

## References

- **Astro Docs:** https://docs.astro.build
- **Tailwind v4:** https://tailwindcss.com/docs/upgrade-guide
- **CVA (class-variance-authority):** https://cva.style/docs
- **Tailwind-merge:** https://github.com/dcastil/tailwind-merge

---

**Last updated:** 2026-02-26 | **Phase:** POC → production (direct main commits)
