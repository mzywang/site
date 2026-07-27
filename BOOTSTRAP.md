# Bootstrap

This repo deploys to Cloudflare as a Worker with static assets, built with SvelteKit's `adapter-cloudflare`. Setup splits into local code changes (each step below is its own pull request, linked inline) and Cloudflare dashboard configuration, which has no `wrangler` CLI equivalent — confirmed via `wrangler --help` and Cloudflare's API docs, none of connecting the repo, setting build/deploy commands, branch control, or API token creation are exposed as commands or endpoints.

Prerequisites: Node >= 22 (Wrangler 4 requires it), `gh` CLI authenticated, a Cloudflare account, a GitHub account.

## Local Setup

### Scaffold the Project

**PR:** [#8](https://github.com/mzywang/site/pull/8)

```bash
npx sv create site --template minimal --types ts \
  --add prettier eslint sveltekit-adapter="adapter:cloudflare+cfTarget:workers" \
  --install npm
npm run gen
```

Use `cfTarget:workers`, **not** `cfTarget:pages` — connecting a repo through Workers & Pages now provisions a Worker with static assets, not classic Pages.

### Gitignore the Generated Types

**PR:** [#9](https://github.com/mzywang/site/pull/9)

- `.gitignore` — add `/worker-configuration.d.ts`
- `.prettierignore` — add `worker-configuration.d.ts` (still generated on disk locally; Prettier doesn't read `.gitignore`, ESLint does)
- `package.json`:
  ```diff
  - "build": "wrangler types --check && vite build",
  + "build": "vite build",
  - "prepare": "svelte-kit sync || echo ''",
  + "prepare": "svelte-kit sync || echo ''; wrangler types",
  - "check": "wrangler types --check && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
  + "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
  ```

`wrangler types`'s output isn't a pure function of `wrangler.jsonc` — it also depends on whether `.svelte-kit/cloudflare/_worker.js` already exists on disk, so a committed copy can look "stale" for reasons that have nothing to do with a real config change. See [PR #9](https://github.com/mzywang/site/pull/9) for detail.

### Pin the Node Version

**PR:** [#10](https://github.com/mzywang/site/pull/10)

```bash
echo 24 > .nvmrc
```

Skip if your default Node is already >= 22.

### Disable checkJs for the Compiled Worker Bundle

**PR:** [#11](https://github.com/mzywang/site/pull/11)

```diff
- "checkJs": true,
+ "checkJs": false,
```

Once `main` is set in `wrangler.jsonc` (`cfTarget:workers` does this for you), `wrangler types` can add a `mainModule` reference that pulls the whole compiled worker bundle into `svelte-check`'s scope, producing hundreds of false errors. `checkJs: false` costs nothing here since there's no plain-JS source. See [PR #11](https://github.com/mzywang/site/pull/11) for detail.

Sanity-check locally before touching Cloudflare:

```bash
npm run gen && npm run build && npx wrangler deploy --dry-run
```

Should print `env.ASSETS  Assets` under bindings, no errors.

### Create the GitHub Repo and Branch Protection

**PR:** none — this step creates the repo itself, so there's nothing to open a pull request against yet.

```bash
gh repo create <you>/<repo> --public --source=. --remote=origin
git push -u origin main

gh api repos/<you>/<repo>/rulesets -X POST --input - <<'EOF'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [{
    "type": "pull_request",
    "parameters": { "required_approving_review_count": 0, "allowed_merge_methods": ["squash"] }
  }]
}
EOF
```

## Cloudflare Dashboard

### Connect the Repository

1. **Connect to Git** — Workers & Pages -> Create -> Connect to Git -> pick your repo.
2. **Build command** — `npm run build`
3. **Deploy command** (Production field) — `npx wrangler deploy`
4. **Environment variables** — `NODE_VERSION=22` (Cloudflare's default build image ships an older Node that fails Wrangler 4's engine check).
5. **Branch control** — Settings -> Builds -> Branch control. Leave "Builds for non-production branches" unchecked (it's off by default) so only the production branch ever builds or deploys.
6. **Deploy token** — profile/api-tokens -> "Edit Cloudflare Workers" template. Confirm **Account Resources** is scoped to your account (easy to miss: it can default to Zone Resources only, which authenticates but authorizes nothing — same generic `Authentication error [code: 10000]` as a wrong deploy command). Paste as `CLOUDFLARE_API_TOKEN` in Settings -> Environment variables, encrypted.
7. **First build** — push to `main` to trigger it.

A correctly-scoped token's summary screen looks like this. The account (not just zone) is named under its own resource block, and `Workers Scripts: Edit` is the permission `wrangler deploy` actually needs:

**Account: `<you>`'s Account**

| Permission                   | Access |
| ---------------------------- | ------ |
| Workers Agents Configuration | Edit   |
| Containers                   | Edit   |
| Workers Observability        | Edit   |
| Workers Builds Configuration | Edit   |
| Cloudflare Pages             | Edit   |
| Workers R2 Storage           | Edit   |
| Workers Tail                 | Read   |
| Workers KV Storage           | Edit   |
| Workers Scripts              | Edit   |
| Account Settings             | Read   |

**Zones: All zones**

| Permission     | Access |
| -------------- | ------ |
| Workers Routes | Edit   |

**Users: All users**

| Permission   | Access |
| ------------ | ------ |
| Memberships  | Read   |
| User Details | Read   |

### Add a Custom Domain

**PR:** [#13](https://github.com/mzywang/site/pull/13)

```jsonc
"routes": [{ "pattern": "your-domain.tld", "custom_domain": true }],
"workers_dev": false
```

Redeploy (`wrangler deploy`, or push to `main`) to provision DNS + SSL.

---

This document was written in [PR #12](https://github.com/mzywang/site/pull/12).
