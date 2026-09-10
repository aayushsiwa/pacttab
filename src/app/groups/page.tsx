import { requireUser } from "@/lib/auth";
import { getUserGroups, getUserPendingJoinRequests } from "@/lib/queries";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { JoinGroupDialog } from "@/components/groups/join-group-dialog";
import { GroupCard } from "@/components/groups/group-card";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderPlus, Clock } from "lucide-react";
import { formatRelativeTime } from "@/lib/date";

export default async function GroupsPage() {
  const user = await requireUser();
  const [userGroups, pendingRequests] = await Promise.all([
    getUserGroups(user.id),
    getUserPendingJoinRequests(user.id),
  ]);

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

      {/* Pending Group Requests for the Current User */}
      {pendingRequests.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Pending Group Requests</span>
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] font-bold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full px-2"
            >
              {pendingRequests.length}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pendingRequests.map((req) => (
              <Card
                key={req.id}
                className="border border-amber-500/30 bg-amber-500/5 rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xs"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-sm shadow-2xs ring-1 ring-amber-500/30">
                        {req.groupName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-bold truncate text-foreground">
                          {req.groupName}
                        </CardTitle>
                        <span className="text-[11px] text-muted-foreground">
                          Requested {formatRelativeTime(req.createdAt)}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-bold tracking-wider shrink-0 rounded-full px-2.5 py-0.5 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/15"
                    >
                      Pending
                    </Badge>
                  </div>

                  {req.groupDescription && (
                    <CardDescription className="line-clamp-2 text-xs mt-1 text-muted-foreground leading-relaxed">
                      {req.groupDescription}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardFooter className="px-5 py-3 flex items-center justify-between text-xs text-muted-foreground border-t border-amber-500/20 bg-amber-500/10">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Awaiting admin approval</span>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Groups Grid */}
      <div className="mt-8">
        {userGroups.length === 0 && pendingRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center shadow-2xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/15 to-indigo-500/15 text-emerald-600 dark:text-emerald-400 mb-4 shadow-2xs ring-1 ring-border">
              <FolderPlus className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No groups yet</h3>
            <p className="max-w-sm text-xs sm:text-sm text-muted-foreground mt-1.5 mb-6 leading-relaxed">
              Create your first private group to start tracking shared expenses, or join an existing group via an invite link.
            </p>
            <div className="flex items-center gap-3">
              <JoinGroupDialog />
              <CreateGroupDialog />
            </div>
          </div>
        ) : (
          userGroups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {userGroups.map((g, idx) => {
                // Deterministic avatar gradient
                const gradients = [
                  "from-emerald-500 to-teal-600",
                  "from-blue-500 to-indigo-600",
                  "from-purple-500 to-pink-600",
                  "from-amber-500 to-orange-600",
                  "from-rose-500 to-red-600",
                ];
                const gradient = gradients[idx % gradients.length];

                return (
                  <GroupCard
                    key={g.id}
                    group={g}
                    currentUserId={user.id}
                    gradient={gradient}
                  />
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
