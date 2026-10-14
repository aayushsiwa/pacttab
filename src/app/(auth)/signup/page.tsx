import { Suspense } from "react";
import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
