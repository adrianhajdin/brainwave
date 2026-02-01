# SunRegen Healthcare

Corporate landing page for SunRegen Healthcare AG, a Swiss biotech company developing neuroprotective therapies for retinal degeneration. Built with React and Tailwind CSS.

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS 3** - Utility-first styling
- **Vitest** - Unit testing with React Testing Library
- **React Router DOM** - Client-side routing
- **react-just-parallax** - Scroll and mouse parallax effects
- **scroll-lock** - Mobile menu scroll prevention

## Project Structure

```
src/
├── assets/              # Images, icons, and SVG components
│   ├── svg/             # Reusable SVG React components
│   ├── hero/            # Hero section assets
│   ├── socials/         # Social media icons
│   └── index.js         # Centralized asset exports
├── components/
│   ├── __tests__/       # Component tests (Vitest + React Testing Library)
│   ├── design/          # Decorative elements (gradients, curves, lines)
│   ├── Header.jsx       # Navigation bar with mobile hamburger menu
│   ├── Hero.jsx         # Landing hero with company tagline
│   ├── ValueProposition.jsx # Three value proposition cards
│   ├── Pipeline.jsx     # Drug pipeline programs (SR-001, SR-002, Exploratory)
│   ├── Milestones.jsx   # Company history timeline
│   ├── Footer.jsx       # Multi-column footer with links and disclaimer
│   ├── Button.jsx       # Reusable button with SVG border
│   ├── Heading.jsx      # Section heading with optional tagline
│   ├── Section.jsx      # Layout wrapper with side lines and crosses
│   └── Tagline.jsx      # Bracketed tagline text
├── constants/
│   └── index.js         # All static data (navigation, pipeline, milestones, etc.)
├── test/
│   └── assetsMock.js    # Asset mock for tests
├── App.jsx              # Root component composing all sections
├── main.jsx             # React DOM entry point
└── index.css            # Global styles, fonts, Tailwind imports
```

## Getting Started

**Prerequisites:** Node.js and npm

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start Vite dev server              |
| `npm run build`   | Production build to `dist/`        |
| `npm run preview` | Preview production build locally   |
| `npm run lint`    | Run ESLint with zero-warning mode  |
| `npm run test`    | Run Vitest in watch mode           |
| `npm run test:run`| Run all tests once                 |

## Architecture

**Component patterns:**
- Section components (Hero, ValueProposition, Pipeline, Milestones) compose the full page
- `Section.jsx` wraps each section with consistent padding and decorative border lines
- `design/` subfolder isolates purely decorative gradient and SVG elements from functional components
- All static data lives in `constants/index.js` and is mapped over to render lists

**Styling:**
- Tailwind extended with a custom color palette: greens (`color-1` #126a3a, `color-3` #5c9247, `color-4` #8ec543), yellows (`color-2` #fdbb26, `color-5` #f1e17e), neutrals `n-1` through `n-13`
- Custom typography classes (`h1`-`h6`, `body-1`, `body-2`, `tagline`, `button`) defined as Tailwind plugin components
- Three Google Fonts: Sora (body), Source Code Pro (code/buttons), Space Grotesk (taglines)
- Responsive breakpoints: mobile-first with `md:`, `lg:`, `xl:` overrides

**No backend:** This is a static frontend site. No database, API, authentication, or environment variables required. Deployable to any static hosting provider.
