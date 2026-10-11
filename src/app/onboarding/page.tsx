import { completeOnboardingAction } from "@/actions/onboarding";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.needsUsername) redirect("/groups");
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4">
      <form
        action={completeOnboardingAction}
        className="bg-card w-full space-y-4 rounded-2xl border p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-black">Choose your PactTab handle</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            This is what your groups will see. Your provider email stays private.
          </p>
        </div>
        <Input
          name="username"
          required
          minLength={3}
          maxLength={30}
          autoComplete="username"
          placeholder="e.g. arjun_99"
        />
        <Button className="w-full" type="submit">
          Continue
        </Button>
      </form>
    </main>
  );
}
