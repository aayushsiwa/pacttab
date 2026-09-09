import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { parse } from "url";
import { wsHub, broadcastWsEvent } from "../src/lib/ws-hub";
import crypto from "crypto";

async function testMentionFlow() {
  console.log("🚀 Testing Chat @Mention Flow and Detection...\n");

  // 1. Test Mention Regex Parsing
  console.log("1. Testing @mention regex pattern extraction...");
  const mentionRegex = /(@[a-zA-Z0-9_]+)/g;

  const testMessage = "Hello @maya and @arjun_99, please review @bob's receipt!";
  const matches = testMessage.match(mentionRegex) || [];
  if (matches.length !== 3) {
    throw new Error(`Expected 3 mentions, found ${matches.length}`);
  }
  if (matches[0] !== "@maya" || matches[1] !== "@arjun_99" || matches[2] !== "@bob") {
    throw new Error(`Unexpected mention matches: ${JSON.stringify(matches)}`);
  }
  console.log(`   ✓ Correctly parsed ${matches.length} mentions: ${matches.join(", ")}`);

  // 2. Test Autocomplete Query Filtering
  console.log("2. Testing autocomplete member filtering logic...");
  const members = [
    { id: "1", username: "maya_patel" },
    { id: "2", username: "arjun_mehta" },
    { id: "3", username: "maya_sen" },
    { id: "4", username: "rohit" },
  ];

  const filterMembers = (query: string) =>
    members.filter((m) => m.username.toLowerCase().includes(query.toLowerCase()));

  const queryMaya = filterMembers("maya");
  if (queryMaya.length !== 2) {
    throw new Error(`Expected 2 matches for query 'maya', got ${queryMaya.length}`);
  }

  const queryArj = filterMembers("ARJ");
  if (queryArj.length !== 1 || queryArj[0].username !== "arjun_mehta") {
    throw new Error(`Expected 1 match for query 'ARJ', got ${JSON.stringify(queryArj)}`);
  }
  console.log("   ✓ Member filtering is accurate and case-insensitive");

  // 3. Test Real-time Mention Notification via WebSocket
  console.log("3. Testing WebSocket mention delivery and recipient detection...");

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
    const timer = setTimeout(() => reject(new Error("Mention test timed out")), 4000);

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

  // Broadcast a message mentioning maya_superstar
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

  if (!mentionDetected) {
    throw new Error("Recipient failed to detect @mention in incoming WebSocket message");
  }
  console.log(`   ✓ Recipient correctly detected @mention: "${receivedMessageText}"`);

  // Cleanup
  clientSender.close();
  clientMentioned.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log("\n🎉 ALL CHAT MENTION TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

testMentionFlow().catch((err) => {
  console.error("❌ Mention flow test failed:", err);
  process.exit(1);
});
