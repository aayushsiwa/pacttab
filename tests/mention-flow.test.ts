import { describe, it, expect } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { parse } from "url";
import { wsHub, broadcastWsEvent } from "../src/lib/ws-hub";
import crypto from "crypto";

describe("Chat @Mention Flow and Detection", () => {
  it("extracts mentions correctly with regex pattern", () => {
    const mentionRegex = /(@[a-zA-Z0-9_]+)/g;
    const testMessage = "Hello @maya and @arjun_99, please review @bob's receipt!";
    const matches = testMessage.match(mentionRegex) || [];

    expect(matches).toHaveLength(3);
    expect(matches).toEqual(["@maya", "@arjun_99", "@bob"]);
  });

  it("filters members accurately and case-insensitively for autocomplete", () => {
    const members = [
      { id: "1", username: "maya_patel" },
      { id: "2", username: "arjun_mehta" },
      { id: "3", username: "maya_sen" },
      { id: "4", username: "rohit" },
    ];

    const filterMembers = (query: string) =>
      members.filter((m) => m.username.toLowerCase().includes(query.toLowerCase()));

    const queryMaya = filterMembers("maya");
    expect(queryMaya).toHaveLength(2);

    const queryArj = filterMembers("ARJ");
    expect(queryArj).toHaveLength(1);
    expect(queryArj[0].username).toBe("arjun_mehta");
  });

  it("delivers mentions and triggers recipient detection via WebSocket", async () => {
    const testPort = 4001;
    const testGroupId = `grp_mention_${Date.now()}`;
    const senderId = `sender_${Date.now()}`;
    const mentionedUserId = `mentioned_${Date.now()}`;
    const mentionedUsername = "maya_superstar";

    const server = createServer();
    const wss = new WebSocketServer({ noServer: true });

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

    const clientSender = new WebSocket(
      `ws://localhost:${testPort}/api/ws?groupId=${testGroupId}&userId=${senderId}`
    );
    const clientMentioned = new WebSocket(
      `ws://localhost:${testPort}/api/ws?groupId=${testGroupId}&userId=${mentionedUserId}`
    );

    await Promise.all([
      new Promise<void>((resolve) => clientSender.on("open", () => resolve())),
      new Promise<void>((resolve) => clientMentioned.on("open", () => resolve())),
    ]);

    let mentionDetected = false;
    let receivedMessageText = "";

    const mentionPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Mention test timed out")), 5000);

      clientMentioned.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === "new_message") {
            receivedMessageText = data.message.body;
            const isMentioned =
              data.message.authorId !== mentionedUserId &&
              data.message.body.toLowerCase().includes(`@${mentionedUsername.toLowerCase()}`);

            if (isMentioned) {
              mentionDetected = true;
              clearTimeout(timer);
              resolve();
            }
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    await broadcastWsEvent({
      type: "new_message",
      groupId: testGroupId,
      message: {
        id: crypto.randomUUID(),
        body: `Hey @${mentionedUsername}, you owe ₹450 for lunch!`,
        type: "user",
        createdAt: new Date().toISOString(),
        authorId: senderId,
        authorUsername: "alex",
      },
    });

    await mentionPromise;

    expect(mentionDetected).toBe(true);
    expect(receivedMessageText).toContain(`@${mentionedUsername}`);

    clientSender.close();
    clientMentioned.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
