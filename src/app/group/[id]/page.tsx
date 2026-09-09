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
      <div className="mb-4">
        <Link href="/groups">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Groups</span>
          </Button>
        </Link>
      </div>

      {/* Group Room Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {details.group.name}
            </h1>
            <Badge
              variant={details.currentUserRole === "admin" ? "default" : "secondary"}
              className="text-[10px] uppercase font-semibold"
            >
              {details.currentUserRole}
            </Badge>
          </div>

          {details.group.description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
              {details.group.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
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
