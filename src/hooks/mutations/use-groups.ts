"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface CreateGroupInput {
  name: string;
  description?: string;
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: CreateGroupInput) => {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create group");
      }
      return res.json() as Promise<{ success: boolean; groupId?: string }>;
    },
    onSuccess: (data) => {
      if (data.success && data.groupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.lists() });
        router.push(`/group/${data.groupId}`);
        router.refresh();
        toast.success("Group created");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface CreateInviteLinkInput {
  groupId: string;
  expiresInHours?: number | null;
  maxUses?: number | null;
  requiresApproval?: boolean;
  customSlug?: string | null;
}

export function useCreateInviteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInviteLinkInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/invite-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresInHours: data.expiresInHours,
          maxUses: data.maxUses,
          requiresApproval: data.requiresApproval,
          customSlug: data.customSlug,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create invite link");
      }
      return res.json() as Promise<{ success: boolean; token?: string; error?: string }>;
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
        toast.success("Invite link created");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface RotateInviteLinkInput {
  groupId: string;
  oldInviteId?: string;
}

export function useRotateInviteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RotateInviteLinkInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/invite-links/rotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldInviteId: data.oldInviteId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rotate invite link");
      }
      return res.json() as Promise<{ success: boolean; token?: string; error?: string }>;
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
        toast.success("Invite link rotated");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface RevokeInviteLinkInput {
  groupId: string;
  inviteId: string;
}

export function useRevokeInviteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RevokeInviteLinkInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/invite-links/${data.inviteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to revoke invite link");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
        toast.success("Invite link revoked");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface JoinGroupInput {
  token: string;
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: JoinGroupInput) => {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to join group");
      }
      return res.json() as Promise<{
        success: boolean;
        groupId?: string;
        groupName?: string;
        canRequestJoin?: boolean;
        pendingApproval?: boolean;
        error?: string;
      }>;
    },
    onSuccess: (data) => {
      if (data.success && data.groupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.lists() });
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(data.groupId) });
        router.push(`/group/${data.groupId}`);
        router.refresh();
        toast.success(`Joined ${data.groupName || "group"}`);
      } else if (data.pendingApproval) {
        toast.info(data.error || "Join request submitted for approval");
      } else if (data.canRequestJoin) {
        toast.warning(data.error || "Invite expired/capped, you can request to join");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface CreateJoinRequestInput {
  groupId: string;
}

export function useCreateJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateJoinRequestInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/join-requests`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit join request");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.user.pendingJoinRequests });
        toast.success("Join request submitted");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface ReviewJoinRequestInput {
  groupId: string;
  requestId: string;
  decision: "approved" | "declined";
}

export function useReviewJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ReviewJoinRequestInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/join-requests/${data.requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: data.decision }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to review join request");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.user.pendingAdminActions });
        toast.success(`Join request ${variables.decision}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface UpdateGroupInput {
  groupId: string;
  name: string;
  description?: string;
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateGroupInput) => {
      const res = await fetch(`/api/groups/${data.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, description: data.description }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update group");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.lists() });
        toast.success("Group settings updated");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface TransferAdminInput {
  groupId: string;
  newAdminUserId: string;
}

export function useTransferAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TransferAdminInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/transfer-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAdminUserId: data.newAdminUserId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to transfer admin");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
        toast.success("Admin rights transferred");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface LeaveGroupInput {
  groupId: string;
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: LeaveGroupInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/leave`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to leave group");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.lists() });
        router.push("/groups");
        router.refresh();
        toast.success("Left group");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface DeleteGroupInput {
  groupId: string;
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: DeleteGroupInput) => {
      const res = await fetch(`/api/groups/${data.groupId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete group");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.lists() });
        router.push("/groups");
        router.refresh();
        toast.success("Group deleted");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
