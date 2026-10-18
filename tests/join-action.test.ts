import { Children, isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoinPage from "../src/app/join/[token]/page";
import { getCurrentUser } from "../src/lib/auth";
import { createJoinRequest, joinGroup } from "../src/lib/group-service";
import { redirect } from "next/navigation";

vi.mock("../src/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../src/lib/group-service", () => ({ createJoinRequest: vi.fn(), joinGroup: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

function findAction(node: ReactNode): (() => Promise<void>) | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; action?: () => Promise<void> }>(child)) continue;
    if (child.type === "form") return child.props.action;
    const action = findAction(child.props.children);
    if (action) return action;
  }
}

describe("join request server action authentication", () => {
  const renderUser = {
    id: "render-user",
    username: "render_user",
    needsUsername: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(renderUser);
    vi.mocked(joinGroup).mockResolvedValue({
      success: false,
      canRequestJoin: true,
      groupId: "group-id",
    });
  });

  async function renderAction() {
    const action = findAction(
      await JoinPage({ params: Promise.resolve({ token: "invite-token" }) })
    );
    expect(action).toBeTypeOf("function");
    return action!;
  }

  it("redirects to login if the session expires after rendering", async () => {
    const action = await renderAction();
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(action()).rejects.toThrow("redirect:/login?returnTo=/join/invite-token");
    expect(createJoinRequest).not.toHaveBeenCalled();
  });

  it("requires onboarding based on the current session", async () => {
    const action = await renderAction();
    vi.mocked(getCurrentUser).mockResolvedValue({ ...renderUser, needsUsername: true });
    await expect(action()).rejects.toThrow("redirect:/onboarding");
    expect(createJoinRequest).not.toHaveBeenCalled();
  });

  it("creates the request for the current account after switching accounts", async () => {
    const action = await renderAction();
    const currentUser = { ...renderUser, id: "current-user", username: "current_user" };
    vi.mocked(getCurrentUser).mockResolvedValue(currentUser);
    await expect(action()).rejects.toThrow("redirect:/join/invite-token");
    expect(createJoinRequest).toHaveBeenCalledExactlyOnceWith(currentUser, "group-id");
    expect(getCurrentUser).toHaveBeenCalledTimes(2);
    expect(redirect).toHaveBeenCalledWith("/join/invite-token");
  });
});
