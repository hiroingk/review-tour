# Review Tour landing page

Marketing site for Review Tour. It is a private workspace package and is never published to
npm.

## How it stays in sync with the product

The hero demo renders the real viewer: `src/demo/ProductDemo.tsx` embeds the actual
`ReviewWorkspace` component from `packages/viewer/src` (through the same `#/*` alias the
viewer uses internally) — repository header, chapter toolbar, review questions, file tree,
diff, display settings and all. `src/styles.css` imports the viewer design tokens. Any change
to the viewer UI shows up on the landing page on the next build — there are no copied
components or screenshots to refresh.

The landing page owns only the window chrome, the terminal animation, and the autoplay that
cycles chapters until the visitor interacts.

The demo data in `src/demo/demoTour.ts` is a hand-written `ReviewTour` artifact that follows
`@review-tour/schema` types, so schema changes surface here as type errors.

Note: the app intentionally renders without React `StrictMode` — the viewer's file tree
(`@pierre/trees`) wires an imperative model in effects and does not survive StrictMode's
double-invocation, matching how the real viewer app mounts it.

## Commands

```bash
pnpm --filter @review-tour/landing dev     # dev server on http://localhost:3100
pnpm --filter @review-tour/landing build   # static build into landing/dist
```

Set `LANDING_BASE` when the site is served from a subpath (GitHub Pages uses
`LANDING_BASE=/review-tour/`).

## Deployment

`.github/workflows/landing.yml` builds and deploys `landing/dist` to GitHub Pages on every
push to `main` that touches the landing page, the viewer sources, or the schema. Enable
GitHub Pages with the "GitHub Actions" source in the repository settings before the first
deploy. Private repositories skip the deploy job until they already have a Pages site, because
some GitHub plans do not support Pages for private repositories.
