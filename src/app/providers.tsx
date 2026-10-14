"use client";

import { QueryProvider } from "@/providers/query-provider";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryProvider>
  );
}
