export type Tone = "emerald" | "teal" | "indigo" | "amber" | "muted" | "destructive";

export const brandGradient = "from-emerald-600 via-teal-600 to-indigo-600";

export const toneTile: Record<Tone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  muted: "bg-muted/70 text-muted-foreground ring-border ring-1",
  destructive: "bg-destructive/10 text-destructive",
};

export const toneHover: Record<Tone, string> = {
  emerald: "hover:border-emerald-500/40",
  teal: "hover:border-teal-500/40",
  indigo: "hover:border-indigo-500/40",
  amber: "hover:border-amber-500/40",
  muted: "hover:border-border/80",
  destructive: "hover:border-destructive/40",
};

export const tonePill: Record<Tone, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  teal: "border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-300",
  indigo: "border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  amber: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  muted: "border-border bg-muted text-muted-foreground",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const toneDot: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  muted: "bg-muted-foreground",
  destructive: "bg-destructive",
};

export const tonePing: Record<"emerald" | "amber", { soft: string; solid: string }> = {
  emerald: { soft: "bg-emerald-400", solid: "bg-emerald-500" },
  amber: { soft: "bg-amber-400", solid: "bg-amber-500" },
};

export const toneChip: Record<"emerald" | "amber", string> = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};
