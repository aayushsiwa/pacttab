import { Suspense } from "react";
import { SignUpForm } from "./signup-form";

interface SignUpPageProps {
  searchParams: Promise<{
    returnTo?: string;
  }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolvedParams = await searchParams;
  const returnTo = resolvedParams?.returnTo;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
        <SignUpForm returnTo={returnTo} />
      </Suspense>
    </div>
  );
}
