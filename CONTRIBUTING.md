# Contributing to Listo

Thanks for helping! Two kinds of contributions are especially welcome and easy.

## Adding catalog items or translations

The product catalog is a plain bilingual list in
[`web/src/catalog/seed.ts`](web/src/catalog/seed.ts). To add a product:

```ts
{ key: "olive", categoryKey: "fruits-legumes", name: { fr: "Olives", en: "Olives" },
  synonyms: { fr: ["tapenade"] }, defaultUnitKey: "pot" },
```

- `key` — stable, kebab-case, unique.
- `categoryKey` — one of the keys in [`categories.ts`](web/src/catalog/categories.ts).
- `name` — **both** `fr` and `en` are required.
- `synonyms` — optional extra search terms (misspellings, regional names, brands).
- `defaultUnitKey` — optional; one of the keys in [`units.ts`](web/src/catalog/units.ts).

New UI strings go in both [`web/src/i18n/fr.ts`](web/src/i18n/fr.ts) and
[`web/src/i18n/en.ts`](web/src/i18n/en.ts) with the same key path.

## Code

```bash
pnpm install
pnpm -r typecheck
pnpm -r test
```

Guidelines:

- The **sync engine is the sensitive part** — any change to HLC / LWW / tombstone /
  oplog logic must keep the property tests in `server/test/sync.spec.ts` and
  `web/test/*.spec.ts` green, and ideally add a case for the scenario you're changing.
- Keep the server **mono-process** and the data layer on **SQLite** — the whole point is
  trivially self-hostable.
- Match the surrounding style. Conventional Commit messages, please
  (`feat:`, `fix:`, `docs:`…).

## Releasing (maintainers)

Releases are **fully automated** via semantic-release — there is no manual tagging.
Land Conventional Commits on `main` and the `Release` workflow:

1. computes the next version (`feat:` → minor, `fix:`/`docs:`/`chore:`/`refactor:` → patch,
   `BREAKING CHANGE:` → major),
2. tags it, writes `CHANGELOG.md`, and cuts a GitHub release,
3. builds and pushes the multi-arch image to `ghcr.io/beliwin/listo` with the matching
   `latest` / `X` / `X.Y` / `X.Y.Z` tags.

So commit messages directly drive versioning — write them with care.
