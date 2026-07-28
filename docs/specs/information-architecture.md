# Information Architecture

## Primary tasks

The persistent header exposes four learner jobs:

1. **Start** — onboarding and placement
2. **Learn** — curriculum, levels, lessons, and audience paths
3. **Train** — practice, exercises, worksheets, daily drills, games, and boss rounds
4. **Progress** — next move, weekly plan, history, rewards, and reset

Secondary routes live in the **Explore more** disclosure. Support, About, Privacy, and Releases also remain visible in the footer.

## Navigation rules

1. A new learner reaches a first lesson within three decisions.
2. Every lesson links to related exercises and focused practice.
3. Every exercise links back to its lesson and focused practice.
4. General Train actions default to Foundations when no learner context exists.
5. Active primary and secondary routes expose `aria-current="page"` where the link exactly matches.
6. Mobile navigation does not remain sticky or obstruct anchor targets.
7. Privacy and progress controls are always reachable from persistent navigation or the footer.

## Route families

- Onboarding: `/`, `/start-here`, `/assessments`, `/curriculum`
- Learn: `/paths/*`, `/levels/*`, `/lessons/*`, `/exercises/*`
- Train: `/practice`, `/daily-drills`, `/worksheets`, `/mini-games`, `/boss-rounds`
- Progress: `/progress`, `/study-plan`
- Project: `/support`, `/about`, `/privacy`, `/releases`
