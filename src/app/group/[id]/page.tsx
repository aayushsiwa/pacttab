import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getGroupDetails } from "@/lib/queries";
import { getGroupMessages } from "@/actions/chat";
import { GroupTabs } from "@/components/group/group-tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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

      {/* Interactive Tabs and Header */}
      <GroupTabs
        group={details.group}
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
        pendingJoinRequests={details.pendingJoinRequests}
      />
    </div>
  );
}
