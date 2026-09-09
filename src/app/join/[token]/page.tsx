import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { joinGroupAction } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertCircle } from "lucide-react";

interface JoinPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/80 bg-card/90 shadow-xl backdrop-blur-sm rounded-2xl overflow-hidden text-center p-6">
          <CardHeader className="p-0 pb-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 text-emerald-600 dark:text-emerald-400 mb-3 shadow-2xs ring-1 ring-border">
              <Users className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight text-foreground">Group Invitation</CardTitle>
            <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
              You&apos;ve received an invitation to enter a private group room. Sign in or create a handle to join the tab.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 p-0 pt-3">
            <Link href={`/login?returnTo=/join/${token}`} className="w-full">
              <Button className="w-full h-11 rounded-xl font-bold shadow-sm">Sign in to Join</Button>
            </Link>
            <Link href={`/signup?returnTo=/join/${token}`} className="w-full">
              <Button variant="outline" className="w-full h-11 rounded-xl font-semibold border-border/80">
                Create an Account (10 seconds)
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Attempt joining
  const result = await joinGroupAction(token);

  if (result.success && result.groupId) {
    redirect(`/group/${result.groupId}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
            <AlertCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold">Invite Unavailable</CardTitle>
          <CardDescription>
            {result.error || "This invite link is either expired, revoked, or invalid."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pt-2">
          <Link href="/groups">
            <Button variant="outline">Go to Your Groups</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
