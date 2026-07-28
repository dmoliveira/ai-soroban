# Soroban Dojo

A privacy-first Soroban learning app built with Astro. Learners can move from bead reading to mental arithmetic through authored lessons, attempt-first exercises, guided practice, adaptive daily drills, worksheets, mini-games, boss rounds, and local progress tracking.

## Product principles

- **One clear next step:** Start, Learn, Train, and Progress are the primary tasks.
- **Attempt first:** hints, answers, and methods support an honest attempt instead of replacing it.
- **Local first:** no account or analytics are required; learning records stay in the browser.
- **Responsive and accessible:** keyboard, touch, reduced-motion, print, and narrow-screen flows are first-class.
- **Static and portable:** the generated site deploys to GitHub Pages under `/soroban-dojo/`.

## Quick start

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Astro serves the project at `http://localhost:4321/soroban-dojo/`.

## Validation

```bash
npm run check       # Astro, TypeScript, and content schemas
npm test            # worksheet, storage, and content-graph unit tests
npm run build       # production static export
npm run test:e2e    # local Chromium flow tests; starts Astro automatically
```

Use `npm run test:e2e:live` only for an explicit smoke test of the deployed GitHub Pages site. Pull requests run the full local validation bundle in `.github/workflows/ci.yml`; pushes to `main` deploy only after check, unit, and build validation.

## Main routes

- `start-here`, `assessments`, and `curriculum` for onboarding
- `lessons`, `exercises`, `levels`, and audience paths for learning
- `practice`, `daily-drills`, `worksheets`, `mini-games`, and `boss-rounds` for training
- `progress` and `study-plan` for local recommendations and review
- `privacy`, `about`, `support`, and `releases` for project information

## Project structure

- `src/content/` — validated lesson, exercise, and reference content
- `src/components/` — interactive local-first learning experiences
- `src/lib/` — certified challenge, finite mini-game, worksheet, storage, and shared domain helpers
- `src/pages/` — static routes and route-level composition
- `src/styles/` — shared responsive design system
- `tests/` — Node unit tests and Playwright user-flow tests
- `docs/specs/` — product, content, privacy, navigation, and worksheet contracts

## Local data

Soroban Dojo stores lesson completion, exercise state, practice/timer/worksheet history, weekly-plan and placement state, mini-game scores and medals, boss progress and certificates, and a selected learner path. The Progress page can clear all learning records while preserving display preferences. See `docs/specs/privacy-and-data.md` for the exact contract.

## Contributing content

Reuse existing frontmatter and route patterns. Content IDs must be unique, every prerequisite/related/next link must resolve, and skills must use the taxonomy in `src/content/config.ts`. Run the complete validation bundle before opening a pull request.
