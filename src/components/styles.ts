/** Class-name helpers shared by server and client components. */
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const btn = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  ghost: "text-slate-600 hover:bg-slate-100",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};
export type ButtonVariant = keyof typeof btn;

export const buttonClass = (v: keyof typeof btn = "primary", small = false) =>
  cx("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50", small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm", btn[v]);
