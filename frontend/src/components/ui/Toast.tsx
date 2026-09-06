import { useEffect } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

export type ToastKind = "success" | "error" | "validation" | "info";

const toastClass = "!max-w-[min(420px,calc(100vw-2rem))] !rounded-xl !border !border-[#dce4dc] !bg-white !px-4 !py-3 !text-sm !font-medium !text-[#183428] !shadow-[0_16px_40px_rgba(13,59,46,0.16)]";

export const appToast = {
  success: (message: string) => toast.success(message, { className: toastClass, duration: 3500 }),
  error: (message: string) => toast.error(message, { className: toastClass, duration: 5000 }),
  validation: (message: string) => toast(message, { className: toastClass, duration: 4500, icon: <AlertTriangle className="text-amber-600" size={19} /> }),
  info: (message: string) => toast(message, { className: toastClass, duration: 4000, icon: <Info className="text-blue-600" size={19} /> }),
  dismiss: toast.dismiss,
};

const looksLikeValidation = (message: string) =>
  /^(please|select|choose|enter|add|provide|ingredient|at least|required|invalid input)/i.test(message.trim());

export function useToastMessage() {
  const showMessage = (message: string) => {
    if (!message) return;
    if (looksLikeValidation(message)) appToast.validation(message);
    else appToast.error(message);
  };
  return ["", showMessage] as const;
}

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
