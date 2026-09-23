import assert from "node:assert/strict";
import { classifyEvent } from "./notify-service.ts";

const valid = { channel: "devtools-team", event: "release.started", data: { version: "1.4.0" }, account_id: "acct-demo" };
assert.equal(classifyEvent(valid), "accepted");
assert.equal(classifyEvent({ ...valid, event: "unknown" }), "rejected");
assert.equal(classifyEvent({ ...valid, data: "text" }), "rejected");
console.log("event boundary tests passed");
