import { requireUser } from "@/lib/auth";
import { getUserGroups } from "@/lib/queries";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { JoinGroupDialog } from "@/components/groups/join-group-dialog";
import { GroupCard } from "@/components/groups/group-card";
import { FolderPlus } from "lucide-react";

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
        )}
      </div>
    </div>
  );
}
