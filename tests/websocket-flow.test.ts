import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { parse } from "url";
import { wsHub } from "../src/lib/ws-hub";
import { broadcastWsEvent } from "../src/lib/ws-hub";
import crypto from "crypto";

async function testWebSocketFlow() {
  console.log("🚀 Testing WebSocket real-time broadcast and event delivery...\n");

  const testPort = 3999;
  const testGroupId = `grp_${Date.now()}`;
  const userAId = `userA_${Date.now()}`;
  const userBId = `userB_${Date.now()}`;

  // 1. Create a standalone test WebSocket server attached to an HTTP server
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
  console.log(`   ✓ Test WebSocket server listening on port ${testPort}`);

  // 2. Connect Client A
  const clientA = new WebSocket(`ws://localhost:${testPort}/api/ws?groupId=${testGroupId}&userId=${userAId}`);
  await new Promise<void>((resolve, reject) => {
    clientA.on("open", () => resolve());
    clientA.on("error", reject);
  });
  console.log("   ✓ Client A connected to group room");

  // 3. Connect Client B
  const clientB = new WebSocket(`ws://localhost:${testPort}/api/ws?groupId=${testGroupId}&userId=${userBId}`);
  await new Promise<void>((resolve, reject) => {
    clientB.on("open", () => resolve());
    clientB.on("error", reject);
  });
  console.log("   ✓ Client B connected to group room");

  // Verify connected count
  if (wsHub.getConnectedCount(testGroupId) !== 2) {
    throw new Error(`Expected 2 connected clients, got ${wsHub.getConnectedCount(testGroupId)}`);
  }
  console.log("   ✓ wsHub registered both clients in group room");

  // 4. Test real-time chat message broadcast
  console.log("\n4. Testing chat message broadcast from server to clients...");
  const receivedByB: Array<{ type: string; message?: { id: string; body: string }; description?: string; amount?: number; payerUsername?: string; recipientUsername?: string }> = [];
  clientB.on("message", (data) => {
    try {
      receivedByB.push(JSON.parse(data.toString()));
    } catch {}
  });

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

  // Wait briefly for message delivery
  await new Promise((r) => setTimeout(r, 100));

  const chatMsg = receivedByB.find((m) => m.type === "new_message" && m.message?.id === chatMessageId);
  if (!chatMsg) {
    throw new Error(`Client B did not receive chat message. Received: ${JSON.stringify(receivedByB)}`);
  }
  console.log(`   ✓ Client B received real-time chat message: "${chatMsg.message?.body}"`);

  // 5. Test financial activity broadcast (Expense Created)
  console.log("\n5. Testing expense creation activity broadcast...");
  await broadcastWsEvent({
    type: "expense_created",
    groupId: testGroupId,
    description: "Dinner at Bistro",
    amount: 1500,
    payerUsername: "maya",
  });

  await new Promise((r) => setTimeout(r, 100));
  const expEvent = receivedByB.find((m) => m.type === "expense_created" && m.description === "Dinner at Bistro");
  if (!expEvent) {
    throw new Error(`Client B did not receive expense_created event`);
  }
  console.log(`   ✓ Client B received expense event: "${expEvent.description}" (₹${expEvent.amount})`);

  // 6. Test settlement activity broadcast
  console.log("\n6. Testing settlement recorded activity broadcast...");
  await broadcastWsEvent({
    type: "settlement_recorded",
    groupId: testGroupId,
    amount: 750,
    payerUsername: "arjun",
    recipientUsername: "maya",
  });

  await new Promise((r) => setTimeout(r, 100));
  const setEvent = receivedByB.find((m) => m.type === "settlement_recorded" && m.amount === 750);
  if (!setEvent) {
    throw new Error(`Client B did not receive settlement_recorded event`);
  }
  console.log(`   ✓ Client B received settlement event: @${setEvent.payerUsername} -> @${setEvent.recipientUsername} ₹${setEvent.amount}`);

  // 7. Cleanup
  clientA.close();
  clientB.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log("\n🎉 ALL WEBSOCKET TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

testWebSocketFlow().catch((err) => {
  console.error("❌ WebSocket test failed:", err);
  process.exit(1);
});
