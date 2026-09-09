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
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
              <Users className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Group Invitation</CardTitle>
            <CardDescription>
              You&apos;ve received an invitation to join a private group. Sign in or create an account with just a username to enter.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 pt-2">
            <Link href={`/login?returnTo=/join/${token}`} className="w-full">
              <Button className="w-full">Sign in to Join</Button>
            </Link>
            <Link href={`/signup?returnTo=/join/${token}`} className="w-full">
              <Button variant="outline" className="w-full">
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
