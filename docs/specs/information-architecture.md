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
8. Home, Start Here, Practice, and Progress show one shared local next action instead of stacking competing recommendation cards. Practice URL intent (`resume`, then `level`/`skill`) outranks passive saved context.
9. Weekly plans may be promoted outside Study Plan only when their saved continuity key still matches the current review, placement, or route inputs.
10. Practice's primary hero action mirrors the strongest saved next move. Only a learner with no resume, review, plan, placement, route, or recent-practice context defaults directly to a Foundations session.
11. A learner-path first-lesson URL carries the requested route to its destination. The lesson retains that context when it opens, reports whether the route was saved, retained, or unavailable, and still opens when storage is unavailable.
12. Progress presents its contextual next action before generic Practice, worksheet, and study-plan links; those broad links remain available in the secondary disclosure.

## Route families

- Onboarding: `/`, `/start-here`, `/assessments`, `/curriculum`
- Learn: `/paths/*`, `/levels/*`, `/lessons/*`, `/exercises/*`
- Train: `/practice`, `/daily-drills`, `/worksheets`, `/mini-games`, `/boss-rounds`
- Progress: `/progress`, `/study-plan`
- Project: `/support`, `/about`, `/privacy`, `/releases`
