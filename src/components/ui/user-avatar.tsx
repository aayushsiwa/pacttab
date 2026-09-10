"use client";

import { useState } from "react";
import { getRobohashUrl } from "@/lib/avatar";
import { cn } from "cn";

interface UserAvatarProps {
  username: string;
  size?: "xs" | "sm" | "default" | "md" | "lg" | "xl";
  className?: string;
  showFallbackOnly?: boolean;
}

const sizeClasses = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-xs",
  default: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
  xl: "h-14 w-14 text-lg",
};

const pixelSizes = {
  xs: 60,
  sm: 80,
  default: 120,
  md: 140,
  lg: 180,
  xl: 240,
};

export function UserAvatar({
  username,
  size = "default",
  className,
  showFallbackOnly = false,
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const cleanName = username || "user";
  const initial = cleanName.charAt(0).toUpperCase();

  // Deterministic background gradient for avatar backing
  const gradients = [
    "from-emerald-500/20 to-teal-600/25 border-emerald-500/30",
    "from-indigo-500/20 to-purple-600/25 border-indigo-500/30",
    "from-blue-500/20 to-cyan-600/25 border-blue-500/30",
    "from-amber-500/20 to-orange-600/25 border-amber-500/30",
    "from-rose-500/20 to-pink-600/25 border-rose-500/30",
  ];
  const charCodeSum = cleanName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradientClass = gradients[charCodeSum % gradients.length];

  const roboUrl = getRobohashUrl(cleanName, pixelSizes[size] || 120);

  return (
    <div
      className={cn(
        "bg-muted/60 relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-gradient-to-tr shadow-2xs select-none",
        sizeClasses[size],
        gradientClass,
        className
      )}
      title={`@${cleanName}`}
    >
      {!showFallbackOnly && !hasError ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roboUrl}
            alt={`@${cleanName}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={cn(
              "h-full w-full object-contain p-0.5 transition-opacity duration-200",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
          />
          {!isLoaded && (
            <span className="text-foreground/70 absolute inset-0 flex animate-pulse items-center justify-center font-bold">
              {initial}
            </span>
          )}
        </>
      ) : (
        <span className="text-foreground/80 font-bold">{initial}</span>
      )}
    </div>
  );
}
