import type { ReactNode } from "react";
import { cn } from "cn";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconTile } from "@/components/shared/icon-tile";
import { toneHover, type Tone } from "@/components/shared/tone";

interface FeatureCardProps {
  icon: React.ComponentProps<typeof IconTile>["icon"];
  tone?: Tone;
  title: ReactNode;
  description: ReactNode;
  hoverTone?: Tone;
  className?: string;
}

export function FeatureCard({
  icon,
  tone = "emerald",
  title,
  description,
  hoverTone,
  className,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "border-border/80 bg-card/70 rounded-2xl border shadow-xs transition-all hover:shadow-md",
        toneHover[hoverTone ?? tone],
        className
      )}
    >
      <CardHeader className="p-6">
        <div className="mb-3">
          <IconTile icon={icon} tone={tone} size="lg" />
        </div>
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
