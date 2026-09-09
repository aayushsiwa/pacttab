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
                <Link key={g.id} href={`/group/${g.id}`} className="group block">
                  <Card className="h-full border border-border/80 bg-card/80 transition-all duration-200 hover:border-emerald-500/40 hover:shadow-md hover:-translate-y-0.5 rounded-2xl overflow-hidden flex flex-col justify-between">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${gradient} text-white font-bold text-sm shadow-2xs`}>
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                              {g.name}
                            </CardTitle>
                            <span className="text-[11px] text-muted-foreground">
                              Created group
                            </span>
                          </div>
                        </div>

                        <Badge
                          variant={g.role === "admin" ? "default" : "secondary"}
                          className={`text-[10px] uppercase font-bold tracking-wider shrink-0 rounded-full px-2 py-0.5 ${
                            g.role === "admin"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {g.role}
                        </Badge>
                      </div>

                      {g.description && (
                        <CardDescription className="line-clamp-2 text-xs mt-1 text-muted-foreground leading-relaxed">
                          {g.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardFooter className="px-5 py-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 bg-muted/20">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{g.memberCount} {g.memberCount === 1 ? "member" : "members"}</span>
                      </div>

                      <span className="flex items-center gap-1 font-bold text-xs text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">
                        Open Room <ArrowRight className="h-3 w-3" />
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
