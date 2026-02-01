# Brainwave

A modern AI chatbot landing page built with React and Tailwind CSS, featuring parallax animations, complex UI geometry, and responsive design.

## Tech Stack

- **React 18** - UI framework
- **Vite 5** - Build tool and dev server
- **Tailwind CSS 3** - Utility-first styling
- **React Router DOM** - Client-side routing
- **react-just-parallax** - Scroll and mouse parallax effects
- **scroll-lock** - Mobile menu scroll prevention

## Project Structure

```
src/
├── assets/              # Images, icons, and SVG components
│   ├── svg/             # Reusable SVG React components
│   ├── benefits/        # Benefit card backgrounds and icons
│   ├── collaboration/   # Tool integration logos
│   ├── hero/            # Hero section assets
│   ├── services/        # Service showcase images
│   └── index.js         # Centralized asset exports
├── components/
│   ├── design/          # Decorative elements (gradients, curves, lines)
│   ├── Header.jsx       # Navigation bar with mobile hamburger menu
│   ├── Hero.jsx         # Landing hero with parallax background
│   ├── Benefits.jsx     # Feature cards grid (6 cards)
│   ├── Collaboration.jsx # Tool integrations with rotating icon ring
│   ├── Services.jsx     # AI capabilities showcase
│   ├── Pricing.jsx      # Three-tier pricing section
│   ├── Roadmap.jsx      # Product roadmap with status badges
│   ├── Footer.jsx       # Social links footer
│   ├── Button.jsx       # Reusable button with SVG border
│   ├── Heading.jsx      # Section heading with optional tagline
│   ├── Section.jsx      # Layout wrapper with side lines and crosses
│   └── Tagline.jsx      # Bracketed tagline text
├── constants/
│   └── index.js         # All static data (navigation, pricing, benefits, etc.)
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

## Architecture

**Component patterns:**
- Section components (Hero, Benefits, Pricing, etc.) compose the full page
- `Section.jsx` wraps each section with consistent padding and decorative border lines
- `design/` subfolder isolates purely decorative gradient and SVG elements from functional components
- All static data lives in `constants/index.js` and is mapped over to render lists

**Styling:**
- Tailwind extended with a custom color palette (`color-1` through `color-6`, neutrals `n-1` through `n-13`)
- Custom typography classes (`h1`-`h6`, `body-1`, `body-2`, `tagline`, `button`) defined as Tailwind plugin components
- Three Google Fonts: Sora (body), Source Code Pro (code/buttons), Space Grotesk (taglines)
- Responsive breakpoints: mobile-first with `md:`, `lg:`, `xl:` overrides

**No backend:** This is a static frontend site. No database, API, authentication, or environment variables required. Deployable to any static hosting provider.
