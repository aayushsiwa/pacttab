import { Suspense } from "react";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{
    returnTo?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = await searchParams;
  const returnTo = resolvedParams?.returnTo;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
        <LoginForm returnTo={returnTo} />
      </Suspense>
    </div>
  );
}
