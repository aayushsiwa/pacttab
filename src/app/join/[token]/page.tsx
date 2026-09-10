import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { joinGroupAction } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertCircle, Clock } from "lucide-react";

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
      <Card className="w-full max-w-md shadow-md text-center p-6 rounded-2xl border border-border/80">
        <CardHeader className="p-0 pb-4">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl mb-3 shadow-2xs ring-1 ${
            result.pendingApproval
              ? "bg-amber-500/10 text-amber-500 ring-amber-500/20"
              : result.canRequestJoin
              ? "bg-primary/10 text-primary ring-primary/20"
              : "bg-destructive/10 text-destructive ring-destructive/20"
          }`}>
            {result.pendingApproval ? (
              <Clock className="h-7 w-7 text-amber-500" />
            ) : result.canRequestJoin ? (
              <Users className="h-7 w-7" />
            ) : (
              <AlertCircle className="h-7 w-7" />
            )}
          </div>
          {result.pendingApproval ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <CardTitle className="text-2xl font-black text-foreground">
                  {result.groupName || "Group"}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-bold tracking-wider rounded-full px-2.5 py-0.5 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/15 shadow-2xs"
                >
                  Pending
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                {result.error || "Your request to join this group has been submitted and is awaiting admin approval."}
              </CardDescription>
            </div>
          ) : (
            <>
              <CardTitle className="text-xl font-bold text-foreground">
                {result.canRequestJoin ? "Invite Expired or Capped" : "Invite Unavailable"}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                {result.error || "This invite link is either expired, revoked, or invalid."}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardFooter className="flex flex-col gap-3 p-0 pt-3">
          {result.canRequestJoin && result.groupId && (
            <form
              action={async () => {
                "use server";
                const { createJoinRequestAction } = await import("@/actions/groups");
                await createJoinRequestAction(result.groupId!);
                redirect(`/join/${token}`);
              }}
              className="w-full"
            >
              <Button type="submit" className="w-full h-11 rounded-xl font-bold shadow-sm">
                Request to Join Group
              </Button>
            </form>
          )}

          <Link href="/groups" className="w-full">
            <Button variant="outline" className="w-full h-11 rounded-xl font-semibold">
              Go to Your Groups
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
