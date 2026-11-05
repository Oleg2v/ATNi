import { useEffect, useRef, type ReactNode } from 'react';

/** Native <dialog> modal with Esc, backdrop close and focus return to the opener. */
export function Dialog({ open, onClose, title, children, labelClose = 'Close', wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; labelClose?: string; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
      const first = d.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button:not([data-close])');
      (first ?? d.querySelector<HTMLElement>('button'))?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onCloseEv = () => {
      const o = opener.current as HTMLElement | null;
      if (o && typeof o.focus === 'function') o.focus();
    };
    d.addEventListener('cancel', onCancel);
    d.addEventListener('close', onCloseEv);
    return () => {
      d.removeEventListener('cancel', onCancel);
      d.removeEventListener('close', onCloseEv);
    };
  }, [onClose]);
  return (
    <dialog ref={ref} aria-labelledby="dlg-title" style={wide ? { maxWidth: 'min(960px, calc(100vw - 32px))' } : undefined} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="dialog-head">
        <h2 id="dlg-title">{title}</h2>
        <button type="button" className="btn btn-sm" data-close onClick={onClose} aria-label={labelClose}>✕</button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
