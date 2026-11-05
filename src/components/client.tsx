"use client";
import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass, cx } from "./styles";
import { Icon, type IconName } from "./icons";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "soft";

/** Form submit button: disabled + spinner while pending, optional confirmation prompt. */
export function Submit({ children, variant = "primary", small, confirm, icon, className }: {
  children: ReactNode; variant?: Variant; small?: boolean; confirm?: string; icon?: IconName; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cx(buttonClass(variant, small), className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? <Spinner /> : icon ? <Icon name={icon} className={small ? "h-3.5 w-3.5" : "h-4 w-4"} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary") + " print:hidden"}>
      {label}
    </button>
  );
}

/** Select that submits its form on change (for filters). */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={cx("block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15", props.className)}
    />
  );
}

/** Modal dialog opened by a trigger button. Content is server-rendered (usually a form posting a server action). */
export function Dialog({ trigger, title, description, children, variant = "secondary", small, icon, triggerClassName }: {
  trigger: ReactNode; title: string; description?: ReactNode; children: ReactNode; variant?: Variant; small?: boolean; icon?: IconName; triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button type="button" className={cx(buttonClass(variant, small), triggerClassName)} onClick={() => ref.current?.showModal()}>
        {icon && <Icon name={icon} className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />}
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => { if (e.target === ref.current) close(); }}
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-start shadow-pop backdrop:bg-slate-900/40 backdrop:backdrop-blur-[1px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={close} className="-me-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="×">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </dialog>
    </>
  );
}

/** Kebab/action menu. Items are links or small forms rendered by the server. */
export function Menu({ label, children, align = "end" }: { label: string; children: ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
      </button>
      {open && (
        <div role="menu" className={cx("absolute top-11 z-30 min-w-[13rem] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop", align === "end" ? "end-0" : "start-0")}>
          {children}
        </div>
      )}
    </div>
  );
}

export const menuItemClass = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-slate-700 hover:bg-slate-50";

/** Success toast for `?ok=` messages: auto-hides and removes the parameter from the URL. */
export function Toast({ message, dismissLabel }: { message: string; dismissLabel: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 4500);
    // Drop ?ok= from the address bar without a navigation, so the server-rendered toast stays mounted.
    const url = new URL(window.location.href);
    if (url.searchParams.has("ok")) {
      url.searchParams.delete("ok");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    return () => clearTimeout(timer);
  }, [message]);
  if (!show) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 end-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-pop">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Icon name="check" className="h-4 w-4" /></span>
      <span className="pt-0.5">{message}</span>
      <button type="button" onClick={() => setShow(false)} aria-label={dismissLabel} className="-me-1 rounded p-0.5 text-slate-400 hover:text-slate-700"><Icon name="x" className="h-4 w-4" /></button>
    </div>
  );
}

/** Sets every "present" radio in the surrounding form (attendance sheet shortcut). */
export function MarkAllPresent({ label }: { label: string }) {
  return (
    <button
      type="button"
      className={buttonClass("secondary", true)}
      onClick={(e) => {
        e.currentTarget.closest("form")?.querySelectorAll<HTMLInputElement>('input[type="radio"][value="present"]').forEach((r) => { r.checked = true; });
      }}
    >
      <Icon name="check" className="h-3.5 w-3.5" />{label}
    </button>
  );
}
