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
