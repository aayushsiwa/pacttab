"use client";

import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

export function ScrollToSection() {
  const scrollToSection = () => {
    document.getElementById("how-it-works")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <Button
      size="lg"
      variant="outline"
      onClick={scrollToSection}
      className="border-border/80 hover:bg-muted/60 h-12 w-full rounded-xl px-6 font-semibold transition-all active:scale-[0.98]"
    >
      How it works
      <ArrowDown />
    </Button>
  );
}
