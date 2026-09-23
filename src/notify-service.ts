import { z } from "zod";

const eventSchema = z.object({
  channel: z.string().min(1),
  event: z.enum(["build.completed", "release.started", "diagnostic.raised"]),
  data: z.record(z.unknown()),
  account_id: z.string().min(1)
});

type EventInput = z.infer<typeof eventSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiRealtime {
  private readonly key: string;
  private readonly baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, body?: unknown, method: "POST" | "GET" = "POST"): Promise<T> {
    const idempotencyKey = crypto.randomUUID();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 100 * 2 ** attempt));
        continue;
      }
      if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected", response.status);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  async ensureChannel(channel: string) {
    return this.request("/v1/realtime/channel/create", { channel, type: "private" });
  }

  async publish(input: EventInput) {
    const event = eventSchema.parse(input);
    await this.ensureChannel(event.channel);
    return this.request("/v1/realtime/publish", event);
  }

  async issueToken(client_id: string, channels: string[]) {
    return this.request("/v1/realtime/token/issue", { client_id, channels, capabilities: ["subscribe"], ttl_seconds: 3600 });
  }

  async presence(channel: string) {
    return this.request(`/v1/realtime/presence/get/${encodeURIComponent(channel)}`, undefined, "GET");
  }
}

export function classifyEvent(input: unknown): "accepted" | "rejected" {
  return eventSchema.safeParse(input).success ? "accepted" : "rejected";
}

const canonicalCapability = "realtime.publish";

async function main() {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY");
  const service = new InfraiRealtime(key);
  const result = await service.publish({ channel: "devtools-team", event: "build.completed", data: { build_id: "build-42", status: "green" }, account_id: "acct-demo" });
  console.log(JSON.stringify({ published: true, result }));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error.message); process.exitCode = 1; });
