import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, type Server } from "http";
import { parse } from "url";
import { wsHub, broadcastWsEvent } from "../src/lib/ws-hub";
import crypto from "crypto";

describe("WebSocket Real-time Broadcast & Event Delivery", () => {
  const testPort = 3999;
  const testGroupId = `grp_${Date.now()}`;
  const userAId = `userA_${Date.now()}`;
  const userBId = `userB_${Date.now()}`;

  let server: Server;
  let wss: WebSocketServer;
  let clientA: WebSocket;
  let clientB: WebSocket;
  const receivedByB: Array<{
    type: string;
    message?: { id: string; body: string };
    description?: string;
    amount?: number;
    payerUsername?: string;
    recipientUsername?: string;
  }> = [];

  beforeAll(async () => {
    server = createServer();
    wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
      const { pathname, query } = parse(req.url || "", true);
      if (pathname === "/api/ws") {
        const groupId = typeof query.groupId === "string" ? query.groupId : null;
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req, groupId);
        });
      }
    });

    wss.on("connection", (ws: WebSocket, _req: unknown, groupId: string) => {
      wsHub.register(groupId, ws);
      ws.send(JSON.stringify({ type: "connected", groupId }));
    });

    await new Promise<void>((resolve) => server.listen(testPort, resolve));

    clientA = new WebSocket(
      `ws://localhost:${testPort}/api/ws?groupId=${testGroupId}&userId=${userAId}`
    );
    clientB = new WebSocket(
      `ws://localhost:${testPort}/api/ws?groupId=${testGroupId}&userId=${userBId}`
    );

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        clientA.on("open", () => resolve());
        clientA.on("error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        clientB.on("open", () => resolve());
        clientB.on("error", reject);
      }),
    ]);

    clientB.on("message", (data) => {
      try {
        receivedByB.push(JSON.parse(data.toString()));
      } catch {}
    });
  });

  afterAll(async () => {
    clientA?.close();
    clientB?.close();
    wss?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("registers both clients in wsHub group room", () => {
    expect(wsHub.getConnectedCount(testGroupId)).toBe(2);
  });

  it("broadcasts real-time chat message from server to clients", async () => {
    const chatMessageId = crypto.randomUUID();
    await broadcastWsEvent({
      type: "new_message",
      groupId: testGroupId,
      message: {
        id: chatMessageId,
        body: "Hello from Maya in real-time!",
        type: "user",
        createdAt: new Date().toISOString(),
        authorId: userAId,
        authorUsername: "maya",
      },
    });

    await new Promise((r) => setTimeout(r, 150));
    const chatMsg = receivedByB.find(
      (m) => m.type === "new_message" && m.message?.id === chatMessageId
    );
    expect(chatMsg).toBeDefined();
    expect(chatMsg?.message?.body).toBe("Hello from Maya in real-time!");
  });

  it("broadcasts expense creation activity event", async () => {
    await broadcastWsEvent({
      type: "expense_created",
      groupId: testGroupId,
      description: "Dinner at Bistro",
      amount: 1500,
      payerUsername: "maya",
    });

    await new Promise((r) => setTimeout(r, 150));
    const expEvent = receivedByB.find(
      (m) => m.type === "expense_created" && m.description === "Dinner at Bistro"
    );
    expect(expEvent).toBeDefined();
    expect(expEvent?.amount).toBe(1500);
  });

  it("broadcasts settlement activity event", async () => {
    await broadcastWsEvent({
      type: "settlement_recorded",
      groupId: testGroupId,
      amount: 750,
      payerUsername: "arjun",
      recipientUsername: "maya",
    });

    await new Promise((r) => setTimeout(r, 150));
    const setEvent = receivedByB.find((m) => m.type === "settlement_recorded" && m.amount === 750);
    expect(setEvent).toBeDefined();
    expect(setEvent?.payerUsername).toBe("arjun");
    expect(setEvent?.recipientUsername).toBe("maya");
  });
});
