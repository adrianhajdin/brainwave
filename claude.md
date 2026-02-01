# Claude Code Guide - SunRegen Healthcare

## Project Overview

SunRegen Healthcare is a static React landing page for a Swiss biotech company developing neuroprotective therapies for retinal degeneration. It has no backend, no database, no authentication, and no environment variables. All content is hardcoded in constants. The site is purely presentational.

## Commands

- `npm run dev` - Start dev server (localhost:5173)
- `npm run build` - Production build
- `npm run lint` - ESLint (zero warnings enforced)
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once

## Architecture

### Component Hierarchy

`App.jsx` renders all sections in order: Header, Hero, ValueProposition, Pipeline, Milestones, Footer. Each section is a standalone component with no shared state between them.

### Key Patterns

- **Section wrapper:** Every page section is wrapped in `Section.jsx`, which adds consistent padding and decorative side lines/crosses. Pass `crosses` prop to enable cross decorations, `crossesOffset` for positioning.
- **Design components:** `components/design/` contains purely decorative elements (gradients, curves, background circles). These are separated from functional components (e.g., `design/Hero.jsx`, `design/Header.jsx`).
- **Data-driven rendering:** All repeated content (navigation items, value propositions, pipeline programs, milestones, social links) is defined in `src/constants/index.js` and rendered via `.map()`.
- **Reusable primitives:** `Button.jsx` (with SVG border gradient), `Heading.jsx` (section title + optional tagline + text), `Tagline.jsx` (bracketed uppercase text).
- **SVG as components:** SVG graphics live in `src/assets/svg/` as React functional components (Arrow, Brackets, ButtonSvg, MenuSvg, etc.).

### Styling System

- **Tailwind CSS** with extensive custom config in `tailwind.config.js`
- **Colors:** `color-1` (#126a3a, Dark Green) through `color-6`, with accent yellow `color-2` (#fdbb26). Neutrals `n-1` (#0F172A) through `n-13` (light mode palette with dark text on light backgrounds)
- **Typography classes:** Custom Tailwind components `.h1`-`.h6`, `.body-1`, `.body-2`, `.tagline`, `.quote`, `.button` - use these instead of raw font-size utilities
- **Fonts:** Sora (sans), Source Code Pro (code), Space Grotesk (grotesk) - set via CSS variables
- **Conic gradient:** `bg-conic-gradient` for colorful border effects

### Asset Organization

All images are imported through `src/assets/index.js`. Logo files: `logo.svg`, `logo-symbol.svg`, `logo-symbol-white.svg`. Social icons and other assets are in their respective subdirectories.

### Navigation

Hash-based scrolling (`#about`, `#science`, `#news`, `#investors`, `#contact`). The Header component handles mobile menu toggle with `scroll-lock` to prevent body scroll. Some nav items have `onlyMobile: true` to only show in the hamburger menu.

## Code Conventions

- All components are functional (no class components)
- PascalCase for component files, lowercase for directories
- Props destructured in function signatures
- No state management library - only local `useState` in Header (menu toggle)
- No TypeScript - plain JSX with `@types/react` for editor support only
- Responsive: mobile-first, breakpoints at `md:` (768px), `lg:` (1024px), `xl:` (1280px)
- ESLint 9 flat config (`eslint.config.js`)
- Tests use Vitest + React Testing Library

## Common Tasks

**Adding a new section:**
1. Create component in `src/components/`
2. Wrap content in `<Section>` with appropriate `id` and optional `crosses` prop
3. Add any decorative elements in `src/components/design/`
4. Import and place in `App.jsx` in desired order

**Adding static content:**
1. Add data to `src/constants/index.js`
2. Import and `.map()` in the relevant component

**Modifying colors/typography:**
1. Colors and typography classes are defined in `tailwind.config.js`
2. Font imports are in `src/index.css`
