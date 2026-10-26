# Deploying Corex

Each client, and each public demo, is its own deployment of one app with its own settings (SPEC.md 4.2). There are two ways to run an app: Vercel (recommended) or a Docker container on any server.

## Settings per app

| Setting                                                | web      | school                    | clinic     | finance    | Notes                                                                         |
| ------------------------------------------------------ | -------- | ------------------------- | ---------- | ---------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                             | yes      | yes                       | yes        | yes        | The Supabase project. Fixed at build time.                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                        |          | yes                       | yes        | yes        | Public key; row-level security protects the data. Fixed at build time.        |
| `SUPABASE_SERVICE_ROLE_KEY`                            | yes      | yes                       | yes        | yes        | Server only, never in the browser. Creating sign-ins, files, leads.           |
| `NEXT_PUBLIC_DB_SCHEMA`                                |          | yes                       | yes        | yes        | The client's schema, for example `client_bethel_school`.                      |
| `NEXT_PUBLIC_STORAGE_BUCKET`                           |          | yes                       | yes        | yes        | Same as the schema.                                                           |
| `DB_SCHEMA`                                            |          | optional                  | optional   | optional   | Server only; overrides the schema at run time (D31).                          |
| `EDITION`                                              |          | `college` or `highschool` |            |            | Read at run time.                                                             |
| `DEMO_MODE`                                            |          | demos only                | demos only | demos only | `true` on the public demos (`docs/demos.md`).                                 |
| `APP_URL`                                              |          | yes                       |            |            | Links in emails (password reset).                                             |
| `NEXT_PUBLIC_SITE_URL`                                 | yes      |                           |            |            | The website's address (canonical links, sitemap).                             |
| `NEXT_PUBLIC_ROOT_DOMAIN`                              | yes      | demos                     | demos      | demos      | Builds demo links and "Get this system".                                      |
| `NEXT_PUBLIC_DEMO_HOST_PATTERN`                        | optional |                           |            |            | Demo addresses before the domain exists, e.g. `corex-{subdomain}.vercel.app`. |
| `RESEND_API_KEY`, `LEAD_NOTIFY_TO`, `LEAD_NOTIFY_FROM` | optional |                           |            |            | Email the team about new quote requests.                                      |

Each app's `.env.example` lists its settings with comments. Never commit real values.

## Vercel

1. In Vercel, **Add New > Project**, choose the `corex` repository, then **Import single project** next to the app's folder (`apps/web`, `apps/school`, `apps/clinic` or `apps/finance`). Never import `packages/*`.
2. Root Directory: the app's folder. Framework: Next.js. Leave the install, build and output commands as detected.
3. Add the settings above for that app, then **Deploy**.
4. Add the domain (for example `bethel.corex.lr`) under Settings > Domains.

Each app has a `vercel.json` that skips a build when nothing in that app or its packages changed.

The apps run on Node 22. Vercel picks it from `engines.node` (`22.x`) in the app's own `package.json` (the project's Root Directory); if a build fails with `ERR_PNPM_UNSUPPORTED_ENGINE`, set Settings > Build and Deployment > Node.js Version to 22.x and redeploy.

Vercel's free Hobby plan is for personal, non-commercial use. Client systems and the public demos need the Pro plan.

## Docker

`Dockerfile` at the repository root builds any app into a small Node image that runs the Next.js server on port 3000.

```bash
docker build --build-arg APP=clinic \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> \
  --build-arg NEXT_PUBLIC_DB_SCHEMA=client_rehoboth_clinic \
  --build-arg NEXT_PUBLIC_STORAGE_BUCKET=client_rehoboth_clinic \
  -t corex-clinic-rehoboth .

docker run -d --name rehoboth --restart unless-stopped -p 3002:3000 \
  -e SUPABASE_SERVICE_ROLE_KEY=<service role key> \
  corex-clinic-rehoboth
```

- `NEXT_PUBLIC_` settings are build arguments: rebuild the image to change them. Server settings (`SUPABASE_SERVICE_ROLE_KEY`, `DB_SCHEMA`, `EDITION`, `DEMO_MODE`, `APP_URL`, ...) are passed with `-e` when the container starts. Use an env file (`--env-file`) kept off the repository for the service-role key.
- Put the container behind HTTPS (for example Caddy or nginx with a certificate). The apps send HSTS and need HTTPS for sign-in cookies and the installable app.
- The image runs as a non-root user and has a health check on `/login` (or `/` for the website).
- Behind a company proxy with its own certificate authority, add `--secret id=extra_ca,src=/path/to/ca.pem --build-arg HTTPS_PROXY=http://proxy:port --build-arg NODE_USE_ENV_PROXY=1`. The certificate is used for downloads only and is not kept in the image.

## After deploying

- **Supabase Auth:** add the app's address to Authentication > URL Configuration (Site URL and redirect URLs) so password-reset links come back to it.
- **Exposed schemas:** the client's schema must be listed under Project Settings > Data API (`docs/database.md`).
- **Installable app:** staff can install each app from the browser (Chrome or Edge: the install icon in the address bar; Android: "Add to Home screen"). See `docs/offline.md`.
