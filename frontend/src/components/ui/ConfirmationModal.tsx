import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmationModalProps {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({ title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', pendingLabel = 'Please wait...', pending = false, variant = 'danger', onConfirm, onCancel }: ConfirmationModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = contentRef.current?.closest<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>('[data-confirmation-cancel]')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => { document.removeEventListener('keydown', trapFocus); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  return (
    <Modal title={title} onClose={() => { if (!pending) onCancel(); }} footer={<>
      <Button type="button" data-confirmation-cancel disabled={pending} onClick={onCancel}>{cancelLabel}</Button>
      <Button type="button" variant={variant} disabled={pending} onClick={onConfirm}>
        {pending && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />}
        {pending ? pendingLabel : confirmLabel}
      </Button>
    </>}>
      <div ref={contentRef} className="flex items-start gap-3" aria-busy={pending}>
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700"><AlertTriangle size={20} aria-hidden="true" /></div>
        <div className="min-w-0 text-sm leading-6 text-[#445e50]">{children}</div>
      </div>
    </Modal>
  );
}
