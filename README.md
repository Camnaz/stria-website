# Stria Systems Website

The official Stria Systems website — built with React, Vite, and deployed to Cloudflare Pages.

## Products

- **Trace** — Evidence infrastructure and operational intelligence for AI agents
- **Forge** — Verified execution primitives from observed workflows

## Development

```bash
npm install
npm run dev          # Start dev server at http://localhost:5173
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run deploy:cloudflare  # Deploy to Cloudflare Pages
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Company homepage (evidence layer for enterprise AI) |
| `/platform` | Platform overview (Trace + Forge loop) |
| `/trace` | Trace product page |
| `/forge` | Forge product page |
| `/architecture` | Three-plane architecture (Data × Control × Trust) |
| `/trace/documentation` | Trace developer docs (local prototype, APIs) |
| `/demo` | Demo request form |

## Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: CSS Modules with design tokens (`src/styles/tokens.css`)
- **Animations**: Native CSS (no GSAP/Lenis) — `src/styles/animations.css`
- **Icons**: Lucide React
- **Routing**: React Router v7
- **Deploy**: Cloudflare Pages via Wrangler

## Design System

- **Typography**: Inter + IBM Plex Mono
- **Colors**: Cyan `#06b6d4` (primary), Red `#f43f5e` (accent)
- **Layout**: Alternating dark/light bands, native scroll
- **Components**: Band, Hero, ThreeCol, SectionHeading, ProductCallout, ClosingCTA

## CI/CD (GitHub Actions)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push, PR | TypeScript, tests, build, preview/prod deploy |
| `rust.yml` | Push, PR | Rust fmt, clippy, build, test, audit |
| `release.yml` | Push to main | Semantic Release (version + changelog + GitHub release) |
| `dependabot-auto-merge.yml` | Dependabot PR | Auto-merge patch/minor updates |
| `codeql.yml` | Weekly, Push | CodeQL security analysis |

### Branch Protection
- `main` requires PR review + all CI checks passing
- Conventional commits enforced via husky + commitlint

## Releases

Automated via [semantic-release](https://github.com/semantic-release/semantic-release):

| Commit prefix | Release type |
|---------------|--------------|
| `fix:` | Patch |
| `feat:` | Minor |
| `BREAKING CHANGE:` | Major |

Changelog: `CHANGELOG.md` (auto-generated)

## Environment

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (GitHub secret) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (GitHub secret) |
| `NPM_TOKEN` | For npm publishing (optional, GitHub secret) |

## Related Repositories

- **Trace**: `github.com/Camnaz/Trace` — Rust evidence core, N-API bindings, ML pipeline
- **Forge**: `github.com/Camnaz/Forge` — Verified execution primitives (in development)

## License

Proprietary — Stria Systems, Inc.