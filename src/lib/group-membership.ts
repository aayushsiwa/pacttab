/**
 * Membership helpers shared by the server services and the client UI.
 *
 * The admin-leave rule depends on whether another *admin* is still active, not
 * merely whether another member is: a group can briefly hold more than one
 * active admin, and an admin must never be stranded by a gate that counts
 * plain members.
 */
export interface MembershipLike {
  id: string;
  role: string;
  status?: string;
}

export function isActiveMembership(membership: MembershipLike): boolean {
  return membership.status === undefined || membership.status === "active";
}

export function otherActiveMembers(members: MembershipLike[], userId: string): MembershipLike[] {
  return members.filter((m) => m.id !== userId && isActiveMembership(m));
}

export function otherActiveAdmins(members: MembershipLike[], userId: string): MembershipLike[] {
  return otherActiveMembers(members, userId).filter((m) => m.role === "admin");
}

export function hasOtherActiveAdmin(members: MembershipLike[], userId: string): boolean {
  return otherActiveAdmins(members, userId).length > 0;
}
