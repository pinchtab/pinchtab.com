# REDESIGN: HumanAgentToggle v1 → v2 (Sleek Pinchtab Edition)

**Target:** Match https://pinchtab.com visual language (refined, minimal, SaaS-grade).

## Current v1 Issues
- Heavy amber pill, thick outlines, harsh color blocking
- Oversized capsule (48px), clunky transitions
- Text labels too large (18px bold uppercase)
- Poor visual hierarchy, lacks depth

## v2 Spec (Compact)

### Container
- `h-12` (48px) instead of h-16
- `rounded-2xl` (16px radius) — refined, not pill-shaped
- `bg-slate-900` (inactive) / `bg-yellow-400` (active)
- **Remove:** outline, thick borders, harsh colors
- **Add:** `shadow-sm shadow-black/40`, `box-shadow: inset 0 1px 3px rgba(0,0,0,0.5)` (subtle inner shadow)
- `px-1.5 py-1` padding (tight)

### Knob (Capsule)
- `w-10 h-10` (40px) — smaller, more refined
- `rounded-xl` (12px), not fully circular
- `bg-white` (inactive) / `bg-slate-900` (active)
- `shadow-md shadow-black/30` — soft depth
- Transform: `translateX(0)` (human) / `translateX(124px)` (agent)
- **Animation:** `transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)` (snappy ease-out)

### Icons
- Reduce to `w-5 h-5` (20px)
- **Stroke:** thin-line, minimal style
- Color: `text-slate-500` (inactive state icon) / `text-yellow-400` (active state icon)
- **No filter effects** — rely on color directly

### Label
- Font: Inter, 13px, `font-medium` (500), `tracking-normal`
- `uppercase` removed or kept minimal
- Position: `left-4` (inset), only show active label
- Color: `text-slate-400` (inactive text) / `text-slate-900` (active text)
- Fade transition: `opacity-0` → `opacity-100` (200ms)

### States
- **Hover:** `brightness-105` only
- **Active (press):** `scale-98` (not 0.98, use actual class)
- **Focus:** `ring-2 ring-yellow-400/40 ring-offset-2 ring-offset-slate-950`
- **No state changes on bg** during hover — only on knob/depth

### Animation Priority
- Knob slide is hero movement
- Color change follows (200ms same duration)
- Icon opacity swap (100ms, midpoint of slide)
- Label opacity inverse of icon

## Code Changes
1. **src/components/ui/HumanAgentToggle.astro** → rewrite container + knob + icon logic
2. **tailwind.config.ts** → add `slate-*`, adjust `yellow` if needed, add `cubic-bezier` if needed
3. **Preserve:** localStorage, modechange event, accessibility (role, aria-checked, keyboard)
4. **Remove:** hardcoded #E8A34D, #4A4A52, fancy filter effects

## Result
Polished, modern, SaaS-ready. Looks native to pinchtab.com. No visual clutter. Tactile micro-interactions.

---
**Grade:** Product-ready after this pass.
