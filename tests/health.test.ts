import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
dotenv.config();

import { GET } from "../src/app/api/health/route";

describe("Health Check API Endpoint (/api/health)", () => {
  it("returns 200 OK with database and service status", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(typeof data.timestamp).toBe("string");
    expect(typeof data.responseTimeMs).toBe("number");
    expect(data.services).toBeDefined();
    expect(data.services.database).toBe("connected");
    expect(data.services.websocket).toBe("ready");
  });
});
