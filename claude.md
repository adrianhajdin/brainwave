# Claude Code Guide - Brainwave

## Project Overview

Brainwave is a static React landing page for an AI chatbot product. It has no backend, no database, no authentication, and no environment variables. All content is hardcoded in constants. The site is purely presentational.

## Commands

- `npm run dev` - Start dev server (localhost:5173)
- `npm run build` - Production build
- `npm run lint` - ESLint (zero warnings enforced)

## Architecture

### Component Hierarchy

`App.jsx` renders all sections in order: Header, Hero, Benefits, Collaboration, Services, Pricing, Roadmap, Footer. Each section is a standalone component with no shared state between them.

### Key Patterns

- **Section wrapper:** Every page section is wrapped in `Section.jsx`, which adds consistent padding and decorative side lines/crosses. Pass `crosses` prop to enable cross decorations, `crossesOffset` for positioning.
- **Design components:** `components/design/` contains purely decorative elements (gradients, curves, background circles). These are separated from functional components. Each section has a corresponding design file (e.g., `design/Hero.jsx`, `design/Roadmap.jsx`).
- **Data-driven rendering:** All repeated content (navigation items, pricing tiers, benefits cards, roadmap items, social links, collaboration apps) is defined in `src/constants/index.js` and rendered via `.map()`.
- **Reusable primitives:** `Button.jsx` (with SVG border gradient), `Heading.jsx` (section title + optional tagline + text), `Tagline.jsx` (bracketed uppercase text).
- **SVG as components:** SVG graphics live in `src/assets/svg/` as React functional components (Arrow, Brackets, ButtonSvg, MenuSvg, etc.).

### Styling System

- **Tailwind CSS** with extensive custom config in `tailwind.config.js`
- **Colors:** `color-1` (#AC6AFF) through `color-6` (#FF98E2), neutrals `n-1` (#FFF) through `n-13`
- **Typography classes:** Custom Tailwind components `.h1`-`.h6`, `.body-1`, `.body-2`, `.tagline`, `.quote`, `.button` - use these instead of raw font-size utilities
- **Fonts:** Sora (sans), Source Code Pro (code), Space Grotesk (grotesk) - set via CSS variables
- **Background images:** Benefit cards use `bg-benefit-card-1` through `bg-benefit-card-6`
- **Conic gradient:** `bg-conic-gradient` for colorful border effects (used on roadmap cards, collaboration ring)

### Asset Organization

All images are imported through `src/assets/index.js` (or `public/assets` for some). Assets are grouped by section: `benefits/`, `collaboration/`, `hero/`, `notification/`, `pricing/`, `roadmap/`, `services/`, `socials/`.

### Navigation

Hash-based scrolling (`#features`, `#pricing`, `#how-to-use`, `#roadmap`). The Header component handles mobile menu toggle with `scroll-lock` to prevent body scroll. Some nav items have `onlyMobile: true` to only show in the hamburger menu.

## Code Conventions

- All components are functional (no class components)
- PascalCase for component files, lowercase for directories
- Props destructured in function signatures
- No state management library - only local `useState` in Header (menu toggle) and Hero (parallax ref)
- No TypeScript - plain JSX with `@types/react` for editor support only
- Responsive: mobile-first, breakpoints at `md:` (768px), `lg:` (1024px), `xl:` (1280px)

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
