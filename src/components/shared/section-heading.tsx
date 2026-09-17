import type { ReactNode } from "react";
import { cn } from "cn";
import { brandGradient } from "@/components/shared/tone";

interface SectionHeadingProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Slice of the title rendered in the brand gradient. */
  accent?: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  accent,
  subtitle,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-8", align === "center" ? "text-center" : "text-left", className)}>
      {eyebrow && (
        <span className="border-border/80 bg-card/70 text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold shadow-xs">
          {eyebrow}
        </span>
      )}
      <h2 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
        {title}
        {accent && (
          <>
            {" "}
            <span className={`bg-gradient-to-r ${brandGradient} bg-clip-text text-transparent`}>
              {accent}
            </span>
          </>
        )}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed",
            align === "center" && "mx-auto"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
