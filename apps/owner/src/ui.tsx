import { ReactNode, useEffect, useRef } from 'react';

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'err' | 'warn'; children: ReactNode }) {
  return <div className={`notice ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><b>{title}</b>{children && <p>{children}</p>}</div>;
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e: Event) => { e.preventDefault(); onClose(); };
    d?.addEventListener('cancel', onCancel);
    return () => d?.removeEventListener('cancel', onCancel);
  }, [onClose]);
  return (
    <dialog ref={ref} className="modal" aria-label={title}>
      <div className="modal-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">✕</button></div>
      {children}
    </dialog>
  );
}

export function Spinner({ label = 'Đang tải…' }: { label?: string }) {
  return <div className="spinner" role="status"><span />{label}</div>;
}
