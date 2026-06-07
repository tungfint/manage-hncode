type BadgeProps = {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

const tones = {
  default: "border-zinc-200 bg-zinc-100 text-zinc-700",
  success: "border-teal-200 bg-teal-50 text-teal-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
