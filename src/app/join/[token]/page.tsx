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
        <Card className="border-border/80 bg-card/90 w-full max-w-md overflow-hidden rounded-2xl p-6 text-center shadow-xl backdrop-blur-sm">
          <CardHeader className="p-0 pb-4">
            <div className="ring-border mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 text-emerald-600 shadow-2xs ring-1 dark:text-emerald-400">
              <Users className="h-7 w-7" />
            </div>
            <CardTitle className="text-foreground text-2xl font-black tracking-tight">
              Group Invitation
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
              You&apos;ve received an invitation to enter a private group room. Sign in or create a
              handle to join the tab.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 p-0 pt-3">
            <Link href={`/login?returnTo=/join/${token}`} className="w-full">
              <Button className="h-11 w-full rounded-xl font-bold shadow-sm">
                Sign in to Join
              </Button>
            </Link>
            <Link href={`/signup?returnTo=/join/${token}`} className="w-full">
              <Button
                variant="outline"
                className="border-border/80 h-11 w-full rounded-xl font-semibold"
              >
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
      <Card className="border-border/80 w-full max-w-md rounded-2xl border p-6 text-center shadow-md">
        <CardHeader className="p-0 pb-4">
          <div
            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-2xs ring-1 ${
              result.pendingApproval
                ? "bg-amber-500/10 text-amber-500 ring-amber-500/20"
                : result.canRequestJoin
                  ? "bg-primary/10 text-primary ring-primary/20"
                  : "bg-destructive/10 text-destructive ring-destructive/20"
            }`}
          >
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
              <div className="flex flex-wrap items-center justify-center gap-2">
                <CardTitle className="text-foreground text-2xl font-black">
                  {result.groupName || "Group"}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="rounded-full border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-600 uppercase shadow-2xs dark:text-amber-400"
                >
                  Pending
                </Badge>
              </div>
              <CardDescription className="text-muted-foreground mt-1 text-xs sm:text-sm">
                {result.error ||
                  "Your request to join this group has been submitted and is awaiting admin approval."}
              </CardDescription>
            </div>
          ) : (
            <>
              <CardTitle className="text-foreground text-xl font-bold">
                {result.canRequestJoin ? "Invite Expired or Capped" : "Invite Unavailable"}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs sm:text-sm">
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
              <Button type="submit" className="h-11 w-full rounded-xl font-bold shadow-sm">
                Request to Join Group
              </Button>
            </form>
          )}

          <Link href="/groups" className="w-full">
            <Button variant="outline" className="h-11 w-full rounded-xl font-semibold">
              Go to Your Groups
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
