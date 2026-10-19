import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Settings } from "lucide-react";

interface GroupHeaderProps {
  group: {
    name: string;
    description: string | null;
  };
  currentUserRole: string;
  membersCount: number;
  pendingJoinRequestsCount?: number;
  onMembersClick?: () => void;
  onSettingsClick?: () => void;
}

export function GroupHeader({
  group,
  currentUserRole,
  membersCount,
  pendingJoinRequestsCount = 0,
  onMembersClick,
  onSettingsClick,
}: GroupHeaderProps) {
  return (
    <div className="border-border/80 flex flex-col gap-4 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-xl font-black text-white shadow-sm">
          {group.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
              {group.name}
            </h1>
            <Badge
              variant={currentUserRole === "admin" ? "default" : "secondary"}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                currentUserRole === "admin"
                  ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {currentUserRole}
            </Badge>
          </div>

          {group.description && (
            <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed sm:text-sm">
              {group.description}
            </p>
          )}
        </div>
      </div>

      {(onMembersClick || onSettingsClick) && (
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          {onMembersClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onMembersClick}
              className="border-border/80 hover:bg-muted/80 relative h-9 cursor-pointer gap-2 rounded-xl px-3.5 text-xs font-bold shadow-2xs"
            >
              <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {membersCount} {membersCount === 1 ? "Member" : "Members"}
              </span>
              {currentUserRole === "admin" && pendingJoinRequestsCount > 0 && (
                <span
                  className="relative ml-0.5 flex h-2.5 w-2.5"
                  title={`${pendingJoinRequestsCount} join request(s) awaiting your approval`}
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="ring-background relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-2" />
                </span>
              )}
            </Button>
          )}

          {onSettingsClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSettingsClick}
              className="border-border/80 hover:bg-muted/80 h-9 cursor-pointer gap-2 rounded-xl px-3 text-xs font-bold shadow-2xs"
              title="Group Settings"
            >
              <Settings className="text-muted-foreground h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
