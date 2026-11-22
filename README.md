# Feed Track UI components

Use components from `frontend/src/components/ui` for every reusable UI pattern.

- Use `Card`, `Button`, `Input`, `Dropdown`, `Badge`, and `DataTable` instead of raw styled equivalents.
- Use `Checkbox` for checkbox controls.
- Use `Dropdown` for every select control and filter; do not add raw `<select>` elements in pages.
- Add a component when a UI pattern appears in more than one page.
- Keep pages focused on data loading and composition; keep shared visual behavior in UI components.

## Toast notifications

Transient success, error, validation, and information messages must use the shared `appToast` service from `frontend/src/components/ui/Toast.tsx`. The application mounts `AppToaster` once in `App.tsx` and displays notifications at the top-right of the viewport. Do not render transient messages through `PageContainer.notice`, manual alert divs, or page-local fixed-position markup.

```tsx
import { appToast } from "../../components/ui/Toast";

appToast.success("Saved successfully.");
appToast.error("Unable to save the record.");
appToast.validation("Complete all required fields.");
appToast.info("The report is being prepared.");
```

## Application architecture

The frontend is organized by business module under `frontend/src/modules`. Shared presentation components live in `frontend/src/components/ui`, layout components live in `frontend/src/components/layout`, and all HTTP/session behavior goes through `frontend/src/shared/api/http.ts`. Pages must not call `fetch` directly. The authenticated organization is attached to every tenant request and changing it remounts the active module so stale organization data is not retained.

The backend separates process startup (`backend/src/server.ts`) from Express application composition (`backend/src/app.ts`). Authentication, tenant-aware RBAC, users, and organizations live under `backend/src/modules`; inventory workflows live under `backend/src/routes`. Every workflow route passes through authentication, tenant selection, and an organization-specific permission check before its handler runs.

Security rules:

- Permissions are evaluated for the selected organization. A role in one organization does not grant access in another.
- Access tokens are short-lived and refresh tokens rotate after use.
- User creation never updates or resets an existing account.
- Super Admin creates organizations; Admin manages users only in assigned organizations.
- Production CORS accepts only origins listed in `WEB_ORIGIN` (comma-separated when multiple origins are required).
- Secrets and database credentials belong in environment variables and must not be committed.

Validation commands:

```powershell
npm run build
npm run lint --prefix frontend
docker compose up -d --build
```

## Responsive UI standards

- Build pages mobile-first with shared `PageContainer`, `PageHeader`, `Card`, form controls, `Modal`, and `DataTable` components.
- Interactive controls need a visible keyboard focus state and a minimum 44px touch target unless they are compact table actions.
- Page actions wrap on small screens, forms collapse to one column, dialogs become bottom-aligned mobile sheets, and tables keep horizontal scrolling with mobile pagination.
- Preserve semantic labels, dialog titles, accessible icon-button names, reduced-motion preferences, and the application skip link.
- Keep table headers neutral and square as part of the current Feed Track visual language.

## Local Docker setup

`docker-compose.yml` runs the frontend at http://localhost:5173 and connects the
backend to your existing host PostgreSQL database. It does not create another
local database. PostgreSQL must be reachable from Docker. Defaults match the
previous local database URL (`postgres`, password `1234`, database `inventory`).

```bash
docker compose -f docker-compose.yml up -d --build
```

For different credentials, copy `.env.local.example` to `.env.local`, edit it,
and run:

```bash
docker compose --env-file .env.local -f docker-compose.yml up -d --build
```

The default local bootstrap account is `musfiqur.utsho@gmail.com` with password
`123456`. Set `LOCAL_SUPER_ADMIN_EMAIL` to your existing admin email
if you want to reuse that account. Existing account passwords are not reset.

## Fresh Ubuntu server deployment (public IP, no domain)

Use `docker-compose.production.yml` by itself. It runs the frontend on port 80,
the API internally on port 4000, and PostgreSQL internally on port 5432. Only the
frontend is published to the server. The Compose project is `inventory-production`
with database volume `inventory-production_inventory_pg`.

After installing Docker Engine and the Compose plugin, upload the latest project
source to the server and run from the project root:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Fill every blank value. `SERVER_IP` is the server's public IPv4 address without a
protocol or port. Generate `POSTGRES_PASSWORD` with `openssl rand -hex 24` and
`JWT_SECRET` with a separate `openssl rand -hex 32` command. Use a valid email
and a long password for `INITIAL_SUPER_ADMIN_EMAIL` and
`INITIAL_SUPER_ADMIN_PASSWORD` (minimum 6 characters). Single-quote passwords
containing `$` or `#` in the env file.

```bash
sudo docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
sudo docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
sudo docker compose --env-file .env.production -f docker-compose.production.yml ps
sudo docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 backend
```

Allow inbound TCP port 80 in the hosting provider's firewall. If UFW is enabled,
allow your SSH port before changing firewall rules, then allow `80/tcp`. Open
`http://YOUR_SERVER_IP` and sign in with the configured initial Super Admin email
and password. HTTP traffic is unencrypted.

On first startup, PostgreSQL creates an empty `inventory` database; the backend
runs `prisma db push` to create application tables, then bootstraps permissions,
roles, the initial workspace, and its Super Admin. No products, stock, or
transactions are imported from your local database. Subsequent startups preserve
data and do not reset the existing Super Admin password. Changing the bootstrap
password in the env file does not change an existing user's password.

PostgreSQL initialization settings apply when the volume is empty. Keep the same
database credentials on later deployments unless you deliberately change the
password inside PostgreSQL too. Changing `.env.production` alone will not change
an existing database password.

Deploy later code updates with the same `up -d --build` command. Startup applies
schema changes through `prisma db push`; take a database backup before updates.
Do not add `--accept-data-loss` to bypass a failed schema update. Ordinary
`docker compose ... down` preserves the database; **never use `down -v` to update
this deployment**, as it deletes the database volume.

Production secrets belong only in `.env.production`, which is ignored by Git.
Docker Compose requires the production values to be present before starting:
https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
