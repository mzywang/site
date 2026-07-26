# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.16.6 create --template minimal --types ts --add prettier eslint sveltekit-adapter="adapter:cloudflare+cfTarget:pages" --install npm site
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deploying to Cloudflare

This project is deployed as a Worker with static assets (not a classic Cloudflare Pages project). `wrangler.jsonc` sets `main` to the adapter's `_worker.js` and configures `assets.directory`.

Build command: `npm run build`
Deploy command: `npx wrangler deploy`

Preview deployments (non-production branches) use the same deploy command.

Requires a `CLOUDFLARE_API_TOKEN` env var with the "Edit Cloudflare Workers" template (includes `Workers Scripts:Edit`).
