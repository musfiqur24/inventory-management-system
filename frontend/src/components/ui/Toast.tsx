import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { appToast, toastClass } from "./ToastMessages";
export function AppToaster() {
  useEffect(() => {
    const showSuccess = (event: Event) => appToast.success((event as CustomEvent<{ message: string }>).detail.message);
    window.addEventListener("apiMutationSuccess", showSuccess);
    return () => window.removeEventListener("apiMutationSuccess", showSuccess);
  }, []);
  return (
    <Toaster
      position="top-right"
      gutter={12}
      containerClassName="!top-5 !right-5"
      toastOptions={{ className: toastClass }}
    />
  );
}
