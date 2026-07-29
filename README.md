# Soroban Dojo

A privacy-first Soroban learning app built with Astro. Learners can move from bead reading to mental arithmetic through authored lessons, attempt-first exercises, guided practice, certified worksheets and challenges, finite mini-games, boss rounds, and honest local progress evidence.

## Product principles

- **One clear next step:** Start, Learn, Train, and Progress are the primary tasks.
- **Attempt first:** hints, answers, and methods support an honest attempt instead of replacing it.
- **Local first:** no account or analytics are required; learning records stay in the browser.
- **Responsive and accessible:** keyboard, touch, reduced-motion, print, and narrow-screen flows are first-class.
- **Static and portable:** the generated site deploys to GitHub Pages under `/soroban-dojo/`.

## Quick start

Requires Node.js 22.12.0 or newer and npm 9.6.5 or newer.

```bash
npm ci
npm run dev
```

Astro serves the project at `http://localhost:4321/soroban-dojo/`.

## Validation

```bash
npm run check       # Astro, TypeScript, and content schemas
npm run audit:dependencies # high-severity audit across the installed build and test graph
npm test            # domain, storage, content-graph, and theme unit tests
npm run test:release # 0.4 metadata, public-doc, and workflow contract
npm run build       # production static export
npm run test:content-build # built content routes, sitemap URLs, and trusted lesson bootstrap
npm run test:theme-build # production theme-bootstrap ordering
npm run test:e2e    # local Chromium flow tests; starts Astro automatically
npm run test:e2e:release-smoke # narrow, no-retry release/privacy/base-path smoke
```

Use `npm run test:e2e:live` only for an explicit broad test of the deployed GitHub Pages site. Pull requests audit dependencies and run check, release contract, unit, build-content, production-theme, and full local browser gates in `.github/workflows/ci.yml`. Pushes to `main` repeat those gates before deployment, then run the narrow release smoke against the deployed Pages URL.

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

## Current release

Soroban Dojo 0.4.0 adds prospective first-check evidence, additive compatibility for legacy local records, certified deterministic worksheet families, the Ten Bridge challenge, the Bead Builder mini-game, and a practice-first responsive layout. It preserves browser-only storage while strengthening validation across themes, accessibility, privacy, compatibility, preview builds, and the deployed Pages site.

## Local data

Soroban Dojo stores lesson completion, exercise state, practice/timer/worksheet history, prospective first-check evidence, weekly-plan and placement state, mini-game scores and medals, boss progress and certificates, an explicitly selected learner route, and the selected display theme. Home, Start Here, Practice, Progress, and Study Plan use those existing local records to choose one context-aware next action; recommendation reads do not create or rewrite learner state. Route and placement controls can clear their own context without erasing other progress. Reading legacy route or placement state never rewrites it. Pre-0.4 activity is not promoted into verified mastery. If a 0.4 versioned companion record is malformed or the schema marker names a newer version, learning-state writes are disabled rather than overwriting those unknown records; other malformed local records use safe read-time fallbacks. The Progress page can clear all learning records while preserving display preferences. See `docs/specs/privacy-and-data.md` for the exact contract.

## Display themes

Use the header selector to choose Washi, Sakura, or Sumi. Washi is the default; a valid selection is saved only in the current browser and applied before the page styles load to avoid a theme flash. Invalid or unavailable browser storage safely falls back to Washi without affecting study progress.

## Contributing content

Reuse existing frontmatter and route patterns. Content IDs must be unique, every prerequisite/related/next link must resolve, and skills must use the taxonomy in `src/content.config.ts`. Run the complete validation bundle before opening a pull request.
