# Feed Track UI components

Use components from `frontend/src/components/ui` for every reusable UI pattern.

- Use `Card`, `Button`, `Input`, `Select`, `Badge`, and `DataTable` instead of raw styled equivalents.
- Use `Checkbox` for checkbox controls.
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
