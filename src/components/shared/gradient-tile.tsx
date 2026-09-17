import type { ReactNode } from "react";
import { cn } from "cn";
import { brandGradient } from "@/components/shared/tone";

interface GradientTileProps {
  children: ReactNode;
  size?: "xs" | "sm" | "md" | "lg";
  rounded?: "lg" | "xl";
  weight?: "bold" | "black";
  /** Tailwind gradient stops, e.g. "from-emerald-500 to-teal-600". Defaults to the brand gradient. */
  gradient?: string;
  className?: string;
}

const sizeClasses = {
  xs: "h-8 w-8 text-sm",
  sm: "h-9 w-9 text-base",
  md: "h-10 w-10 text-sm",
  lg: "h-11 w-11 text-base",
};

export function GradientTile({
  children,
  size = "md",
  rounded = "xl",
  weight = "black",
  gradient = brandGradient,
  className,
}: GradientTileProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-tr text-white shadow-sm",
        sizeClasses[size],
        rounded === "lg" ? "rounded-lg" : "rounded-xl",
        weight === "bold" ? "font-bold" : "font-black",
        gradient,
        className
      )}
    >
      {children}
    </div>
  );
}
