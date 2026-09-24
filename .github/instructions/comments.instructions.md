---
description: 'Project-wide comment and documentation philosophy and expectations'
applyTo: '**/*.*'
---

# Comment & Documentation Guidelines

This file defines the project's comment and documentation philosophy and the concrete expectations for code comments, TSDoc/JSDoc, and component API documentation.

## Philosophy: comment intent, not mechanics

- Comment *why*, not *what*. Explain the reasoning, tradeoffs, invariants, and non-obvious decisions. Do not restate what the code already expresses.
- Keep comments short and focused. If you find yourself explaining the mechanics line-by-line, prefer extracting a well-named helper with a descriptive function name and a short TSDoc comment instead.
- Treat stale or misleading comments as bugs. When changing code, update or remove related comments in the same commit.

## TSDoc / JSDoc expectations (data layer & helpers)

For every exported function, class, or constant in `db/` and `src/lib/` the repository requires a TSDoc/JSDoc comment that documents:

- One-line summary of purpose
- Parameters (name and brief description) including the injectable `db` parameter when present
- Return type/shape and any special behaviors (e.g., returns `null` when not found)
- Side effects (migrations, seeding, cache writes) when applicable

Example:

```ts
/**
 * Get a game by id including its relations.
 *
 * @param db - Drizzle Database instance to run queries against (injectable for tests)
 * @param id - Game id to fetch
 * @returns The game with relations or `null` when not found
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> { ... }
```

## Component Props documentation (Astro components)

- Each reusable `.astro` component must declare a `Props` interface in its frontmatter and include a short TSDoc comment above it describing the component's public API and each prop.
- Document optional props, default values, and expected shapes. Prefer small, focused props rather than large catch-all objects.

Example:

```astro
---
/**
 * Props for the GameCard component.
 *
 * @prop game - The game to render (required)
 * @prop compact - When true, render a compact variant (optional, default: false)
 */
interface Props {
  game: Game;
  compact?: boolean;
}
---
```

## Where to put longer documentation

- Use README sections for high-level policies and where-to-find guidance.
- Use the `.github/instructions` folder for process or contributor-facing rules. Keep code comments for short, local explanations.

## Enforcement & Tooling

- Prefer lightweight enforcement via ESLint rules: require TSDoc-style comments on exported functions in `db/` and `src/lib/` (see `.eslintrc` for project rules). If a new rule is added, include a short explanation in this file and update the README link.
- Code review should catch missing or outdated comments; treat missing TSDoc for exported helpers as a review comment.

## Examples of good and bad comments

Good:
// Explain the tradeoff for using a LEFT JOIN here to include legacy rows without categories.

Bad:
// Select games from the games table


