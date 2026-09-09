import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGroupDetails } from "@/lib/queries";
import { getGroupMessages } from "@/actions/chat";
import { GroupTabs } from "@/components/group/group-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";

interface GroupPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { id: groupId } = await params;
  const user = await requireUser();

  const details = await getGroupDetails(groupId, user.id);
  if (!details) {
    notFound();
  }

  const messages = await getGroupMessages(groupId);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      {/* Back button & Breadcrumb */}
      <div className="mb-5 flex items-center justify-between">
        <Link href="/groups">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold rounded-lg h-8 px-2.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Groups</span>
          </Button>
        </Link>
        <span className="text-xs text-muted-foreground hidden sm:inline-block">
          Private Room • Real-time Sync
        </span>
      </div>

      {/* Group Room Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-6 border-b border-border/80">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-white font-black text-xl shadow-sm">
            {details.group.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {details.group.name}
              </h1>
              <Badge
                variant={details.currentUserRole === "admin" ? "default" : "secondary"}
                className={`text-[10px] uppercase font-bold tracking-wider rounded-full px-2.5 py-0.5 ${
                  details.currentUserRole === "admin"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {details.currentUserRole}
              </Badge>
            </div>

            {details.group.description ? (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
                {details.group.description}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Private expense & activity room
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-xl border border-border/60 shadow-2xs">
            <Users className="h-3.5 w-3.5 text-foreground/70" />
            <span>{details.members.length} {details.members.length === 1 ? "member" : "members"}</span>
          </div>
        </div>
      </div>

      {/* Interactive Tabs */}
      <GroupTabs
        groupId={groupId}
        currentUserId={user.id}
        currentUsername={user.username}
        currentUserRole={details.currentUserRole}
        members={details.members}
        messages={messages}
        expenses={details.expenses}
        settlements={details.settlements}
        balances={details.balances}
        suggestedSettlements={details.suggestedSettlements}
        activeInvites={details.activeInvites}
      />
    </div>
  );
}
