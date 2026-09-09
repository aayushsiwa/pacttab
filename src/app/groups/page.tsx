import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserGroups } from "@/lib/queries";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { JoinGroupDialog } from "@/components/groups/join-group-dialog";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight, FolderPlus } from "lucide-react";

export default async function GroupsPage() {
  const user = await requireUser();
  const userGroups = await getUserGroups(user.id);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Your Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Private expense tabs and chat rooms. Only invited members can see what is here.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <JoinGroupDialog />
          <CreateGroupDialog />
        </div>
      </div>

      {/* Groups Grid */}
      <div className="mt-8">
        {userGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
              <FolderPlus className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">No groups yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground mt-1 mb-6">
              Create your first private group to start tracking shared expenses, or join using an invite link.
            </p>
            <div className="flex items-center gap-3">
              <JoinGroupDialog />
              <CreateGroupDialog />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {userGroups.map((g) => (
              <Link key={g.id} href={`/group/${g.id}`} className="group block">
                <Card className="h-full border transition-all duration-200 hover:border-foreground/30 hover:shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">
                        {g.name}
                      </CardTitle>
                      <Badge
                        variant={g.role === "admin" ? "default" : "secondary"}
                        className="text-[10px] uppercase font-semibold shrink-0"
                      >
                        {g.role}
                      </Badge>
                    </div>
                    {g.description && (
                      <CardDescription className="line-clamp-2 text-xs mt-1">
                        {g.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardFooter className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t bg-muted/20">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>{g.memberCount} {g.memberCount === 1 ? "member" : "members"}</span>
                    </div>

                    <span className="flex items-center gap-1 font-medium text-foreground group-hover:translate-x-0.5 transition-transform">
                      Open <ArrowRight className="h-3 w-3" />
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
