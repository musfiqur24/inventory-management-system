# Feed Track UI components

Use components from `frontend/src/components/ui` for every reusable UI pattern.

- Use `Card`, `Button`, `Input`, `Dropdown`, `Badge`, and `DataTable` instead of raw styled equivalents.
- Use `Checkbox` for checkbox controls.
- Use `Dropdown` for every select control and filter; do not add raw `<select>` elements in pages.
- Add a component when a UI pattern appears in more than one page.
- Keep pages focused on data loading and composition; keep shared visual behavior in UI components.

Tailwind is compiled through the Vite plugin using `virtual:tailwind.css`. Keep dynamic utility classes as complete strings in `frontend/src/shared/styles/variants.ts`. Print reports reuse the compiled application stylesheet.

## Toast notifications

Transient success, error, validation, and information messages must use the shared `appToast` service from `frontend/src/components/ui/ToastMessages.tsx`. The application mounts `AppToaster` once in `App.tsx` and displays notifications at the top-right of the viewport. Do not render transient messages through `PageContainer.notice`, manual alert divs, or page-local fixed-position markup.

```tsx
import { appToast } from "../../components/ui/ToastMessages";

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

## Local development

Use Node 22 and PostgreSQL 17. Install with npm ci in backend and frontend.
The local Compose file connects to your existing host PostgreSQL database using
host.docker.internal. It keeps the previous local account and database defaults.
For other settings copy .env.local.example to .env.local.

```bash
docker compose --env-file .env.local -f docker-compose.yml up -d --build
```

Omit --env-file if using defaults. A separate migrate service now applies tracked
migrations before the API starts. Production never uses prisma db push.
Existing databases are adopted only when they match prisma/baseline.prisma.
Unexpected drift stops migration and requires review; no reset is performed.
The bootstrap admin is created only on an empty database. Changing bootstrap
settings does not change an existing account or restore removed memberships.

## Production rollout on the Ubuntu server

Use docker-compose.production.yml alone. The project remains inventory-production
and preserves inventory-production_inventory_pg and the Caddy volumes. PostgreSQL
and the API have no published host ports. Caddy exposes 80/443 with internal HTTPS
for SERVER_IP; a domain is optional. Each client must trust this Caddy root CA.

Production Compose separates the internal database network from the application
network: only the API and migration job can reach PostgreSQL. The API retains
outbound access for email delivery. Caddy waits for API and frontend health;
frontend health checks verify that Nginx can serve the built index.html. Runtime
services use unless-stopped; the migration job exits without restarting. An
unhealthy status alone does not restart a container: alert on failed readiness
and investigate before restarting. API and database shutdown allow 30 seconds.

Keep the production env file outside the checkout with directory mode 700 and
file mode 600, as shown below. Compose injects only the listed variables into
each service; its --env-file option supplies interpolation values. These values
remain accessible to Docker administrators and container inspection. Do not
publish resolved Compose configuration, copy secrets into images, or put secrets
in VITE_* variables (they become public browser code). Use separate random hex
passwords for the database owner and application role; arbitrary URL-reserved
characters require encoding in DATABASE_URL. Changing POSTGRES_PASSWORD does
not rotate an existing database password: coordinate SQL role changes and env
updates during a maintenance window. Preserve MFA_ENCRYPTION_KEY across releases.

This configuration serves an IP address using a private Caddy CA. For public
browser access, configure a DNS hostname, publicly trusted TLS, matching
WEB_ORIGIN/PASSWORD_RESET_URL values, and update the IP-specific deployment
verification scripts together. Restrict ingress with the host/cloud firewall;
only Caddy publishes ports. Local Compose binds port 5173 to loopback and uses
development credentials and insecure cookies; use the production file alone on
the server.

Before the first upgrade, retain an independent database backup and a copy of
Caddy data and the external env file. Rehearse the upgrade against a restored
copy of actual data. The automatic baseline checks the schema, not the quality
of every historic business record; new constraints can reject inconsistent data.
Schedule the first upgrade while business writes are paused.

As musfiq on the server, from the project folder:

```bash
mkdir -p ~/.config/inventory
chmod 700 ~/.config/inventory
# On a NEW server only, copy the template; preserve an existing server env file.
cp .env.production.example ~/.config/inventory/.env.production
chmod 600 ~/.config/inventory/.env.production
nano ~/.config/inventory/.env.production
bash scripts/prepare-production-env.sh
bash scripts/deploy-production.sh
```

For an existing deployment, skip the template copy and edit the existing
~/.config/inventory/.env.production. Set SERVER_IP, POSTGRES_PASSWORD, JWT_SECRET,
INITIAL_SUPER_ADMIN_EMAIL and a strong initial password (12-72 characters).
Generate JWT_SECRET with openssl rand -hex 32. The preparation script generates
APP_DB_PASSWORD and MFA_ENCRYPTION_KEY if absent, without displaying them or
changing existing PostgreSQL/JWT credentials. Keep the MFA key stable: rotating
it without re-enrolling users makes existing authenticator secrets unreadable.

The migration container has schema privileges; the API uses inventory_app and
cannot alter tables. Deployment builds locally for manual runs, or pulls the five
CI-tested image digests. It requires a successful pg_dump before replacing an existing database container
or running migrations,
recreates application containers, and verifies readiness and the SPA using the
actual Caddy root CA. A failure stops rollout and records failed-revision in
~/.local/state/inventory-deploy. No automatic database restore is attempted.
Do not delete database or Caddy volumes during an upgrade.

Sign in, open My Profile, change any previously exposed password and set up
Two-factor authentication. Save the one-use recovery codes offline. Production
administrators/managers must enroll before privileged business writes.

Optional password recovery requires RESEND_API_KEY and a provider-authorized
MAIL_FROM address in the external env file. The app's HTTPS IP address is the
reset-link destination. Tokens are carried in a browser URL fragment; frontend
access logs omit query strings. Delivery uses an encrypted durable outbox with retries;
without a provider the API explicitly reports recovery unavailable. Verify a real
email/reset flow after configuration. Provider failures appear in API logs.

## GitHub CI/CD and GHCR

The workflow tests main pushes and pull requests on GitHub-hosted runners.
Only main pushes/manual runs publish backend, frontend, migration, Caddy and
PostgreSQL images to
GHCR and deploy exact sha256 references. Environment files are excluded from
image build contexts. Publication was explicitly authorized for this project.

1. Protect main: require review and the Build, secure and test check. Restrict who
   may modify workflows and deployment scripts.
2. Create the production GitHub Environment and restrict deployments to main.
   Configure required reviewers if your release policy requires them.
3. Under Settings > Actions > Runners, add the custom label inventory-production
   to the existing inventory runner. Its service must run as musfiq with Docker
   access. Only trusted deployment workflows should target this runner.
4. Check Actions/package policies permit GHCR writes. GITHUB_TOKEN publishes and
   downloads packages; a PAT is unnecessary when packages are linked to this repo
   and grant it Actions access. Keep package visibility consistent with code policy.
5. Keep the env file outside the runner checkout at the location above. Push the
   reviewed changes to main, then inspect the Actions run and deployment health.

CI enforces dependency audits, zero-warning frontend lint, TypeScript builds,
stock tests, real PostgreSQL security/concurrency tests, schema adoption/drift
checks, dump restoration/reconciliation, deployment failure tests, real Caddy
HTTPS and a production-image smoke test. Trivy blocks fixable HIGH/CRITICAL
image vulnerabilities across all five images. Caddy is built with locked patched
Go dependencies. PostgreSQL stays on version 17 with updated OS packages and
Alpine su-exec for dropping privileges; the obsolete bundled Go helper is removed.
Dependabot proposes dependency, Go module, image and action updates.

This repository cannot itself enforce GitHub account settings or isolate a
compromised Docker-capable production runner. Keep untrusted PR workflows on
hosted runners; review repository-wide workflows and runner access before use.

## Backups, restore rehearsal and monitoring

Deployment dumps are local safety copies, not offsite disaster recovery. Configure
an independent backup machine and an age public recipient before enabling daily
backups. Keep its private key offline on another machine. Install age and rsync
on the server, configure SSH access to the destination, then:

```bash
bash scripts/install-backup-timer.sh
nano ~/.config/inventory/backup.env
sudo loginctl enable-linger musfiq
systemctl --user enable --now inventory-backup.timer
systemctl --user start inventory-backup.service
journalctl --user -u inventory-backup.service
```

The encrypted archive contains a PostgreSQL dump, Caddy CA/config data and the
production env file. A SHA-256 manifest is uploaded with it; encrypted local
copies retain 30 days. Configure remote retention independently and verify the
remote checksum. Agree on recovery point/time targets with the business; the
default daily schedule permits up to a day's data loss. Use WAL/PITR if that is
unacceptable.

On an isolated recovery/test machine with Docker and age, validate a downloaded
archive using this repository:

```bash
bash scripts/restore-check.sh /path/to/backup.tar.gz.age /path/to/offline-age-key
```

The script restores into a disposable PostgreSQL container and fails on balance,
ledger or reservation inconsistency. It never targets production. A full recovery
also needs restoring Caddy data/env securely and verifying user access, business
totals and HTTPS trust on a clean server. Rehearse and record the elapsed time.

Configure an external monitor to check /api/v1/ready over verified HTTPS. Liveness
is /api/v1/health. The administrator operations API exposes /operations/metrics,
/operations/audit (cursor pagination), and /operations/reconciliation. Wire
scripts/check-production-health.sh to your monitoring system with
INVENTORY_READY_URL=https://YOUR_SERVER_IP/api/v1/ready; it checks backup freshness
and disk usage. Alert routing and central log storage require operator setup.

## Rollback and credential rotation

Release digests are recorded in ~/.local/state/inventory-deploy/deployed-images;
previous-deployed-images holds the preceding successful release. After reviewing
schema compatibility, restore application images with:

```bash
ROLLBACK_SCHEMA_COMPATIBLE=yes bash scripts/rollback-production.sh previous
```

Omit previous to return to the last successful release after a failed rollout.
This changes application/proxy images only and keeps the running database image.
A database rollback needs a separate reviewed
restore plan and can lose writes after the backup. Verify HTTPS/readiness after
any rollback.

Rotate credentials exposed in chats/screenshots on the actual server. Changing
POSTGRES_PASSWORD in env does not change an existing PostgreSQL role password.
Use psql's interactive password command on the running database first, then
update the external env file to the same new value and redeploy. Change the
existing administrator password in My Profile; bootstrap variables do not reset
it. Rotate JWT_SECRET to revoke old JWTs and clear RefreshToken rows during a
planned session reset. Preserve MFA_ENCRYPTION_KEY. Review Git history and GitHub
secret-scanning alerts separately; ignoring env files does not erase old commits.

## Inventory behavior and known boundaries

RM reorder policy is fixed at strictly below 20 kg per product per RM store,
based on on-hand weight. Dashboard, product totals and alerts share this policy.
The first low receipt alerts once; recovery to 20 kg rearms the next drop.
Product-wise totals are separate from requisition/lot details. Usable availability
excludes held/expired lots and reservations. Reservations bind to approved demand,
are consumed on issue/dispatch and are released on explicit cancellation.

Approved recipes, used stock units/product semantics, stock movements and completed
audit history are protected. History is retained on cancellation. Production
actuals must reconcile with issued materials; output cannot exceed raw weight.
Sales require approval before dispatch. Dispatch prices are snapshotted; older
records without a saved historical price show Price unavailable rather than a
fabricated amount.

Estimated Batch Margin values unsold output using saved output prices. It is not
recognized financial profit or a complete accounting ledger. Accounting valuation,
warehouse transfers/counts/returns/quality approval workflows, broad server-side
pagination and production-size load testing remain separate work. See
production-remediation-status-2026-11-23.txt for the precise audit disposition.

### Readable container logs

The backend uses Winston and writes readable logs to standard output in every
Docker environment. Example (timestamps use Asia/Dhaka):

```text
[2026-11-24 10:30:00] INFO  | Inventory API started | port=4000
[2026-11-24 10:30:01] INFO  | GET /api/v1/products -> 200 (12ms) | request completed
[2026-11-24 10:30:02] ERROR | POST /api/v1/auth/login -> 401 (8ms) | Invalid email or password
```

After changing the logger, rebuild and recreate the backend from the project
folder on the Docker host:

```sh
docker compose up -d --build backend
docker compose logs --follow --tail=100
```

The second command combines logs from all services with container/service
prefixes. To view only backend logs:

```sh
docker compose logs --follow --tail=100 backend
```

For the production stack, use the production Compose file and environment:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build backend
docker compose --env-file .env.production -f docker-compose.production.yml logs --follow --tail=100
```

Run these commands on the host, rather than inside a backend container. Winston
formats backend application logs; PostgreSQL, Caddy, frontend, and migration
containers retain their own logging formats. Docker Compose combines them.
`LOG_FORMAT=pretty` is the default; set `LOG_FORMAT=json` for a log collector.
`LOG_LEVEL` defaults to `info` (other supported values: `error`, `warn`, `http`,
`verbose`, `debug`, `silly`). HTTP logs include method, path, status, duration,
and the response error message for failed requests. All HTTP failures (4xx/5xx)
use ERROR. A generated request ID is returned in `X-Request-ID` and included in
JSON logs. Automatic request logs
exclude bodies, headers, and query strings.

## Feed and Agro access control

Access is assigned through roles. Each module area has separate read and write permissions, such as feed.procurement.read, feed.rm_store.write, and agro.reports.read. Write includes read for the same area. Roles & Permissions provides a permission matrix for creating and editing roles; User Management assigns the role and organizations without individual module switches. Menus and shared dashboard metrics follow the selected organization's role permissions.

Custom roles belong to one organization. Administrators can delegate only permissions they hold and edit only their organization's custom roles. Super Admin can edit system roles except the protected Super Admin role, and extend the module permission catalog with read/write pairs. The existing administrative users.manage, roles.manage, and organizations.manage permissions remain separate. Feature code must enforce a new catalog permission when its operational endpoint is implemented; creating a catalog entry does not create a new feature.

Feed areas include RM Procurement, RM Store, FM Store, Production, Recipes, Sales, Sales Approval, Master Setup, Suppliers & Customers, Weighbridge, and Reports. Grant Master Setup read and Suppliers & Customers read when an operational page needs those lookup lists. Approval actions continue to enforce document state and assigned-person rules. Feed Reports read permits Feed summary metrics and ledger reports. Agro reports and numeric metrics use organization-scoped ModuleReport records; Agro workflows and formulas are not assumed.

From backend, run node --import dotenv/config scripts/migrate.mjs and npm run db:generate. Migration 202611270002_role_area_permissions seeds area permissions and preserves exceptional legacy membership grants in organization-owned roles. MembershipModuleAccess and UserPermissionOverride rows remain as historical data; runtime authorization uses assigned role permissions. The old default module-grant trigger is removed. Role permission changes take effect on the next authenticated API request without issuing a new token.

GET/POST /api/v1/roles and PUT /api/v1/roles/:id manage roles. GET /api/v1/roles/permissions lists the catalog; POST creates a module area with a read/write pair. Role payloads contain name, description, and permissionIds. User creation and assignment updates accept roleId and organizationIds. Per-user modules and overrides payloads are rejected.

Run node scripts/tests/integration.cjs from the repository root for isolated PostgreSQL migrations, role-upgrade fixtures, API authorization, stock rules, and restore checks. The runner overrides both database URLs to a disposable Docker database. Run node backend/node_modules/tsx/dist/cli.mjs --test backend/tests/unit/area-permissions.test.ts for route mapping checks.
