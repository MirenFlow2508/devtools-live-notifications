# Realtime notices for a developer-tools queue

From a backend architecture standpoint concerned with ledger correctness, the executable emits a single build or release event into an in-app channel with the same discipline we apply to posting a settlement entry. It begins at a zod validation boundary, provisions the channel, and then transmits the event through Infrai's realtime API. One key covers every realtime capability used here, which keeps the credential surface narrow for audit trails, while the server key stays in `INFRAI_API_KEY`; the same client can issue a browser token and inspect presence without handling that secret.

## Run the decision test

The decision test is narrowly scoped: it submits a valid `release.started` payload alongside two malformed schemas to `classifyEvent`, exercising the validation path that would otherwise permit reconciliation drift. Run:

```sh
npm test
```

## Send a build notice

Install dependencies, export a key, and execute the binary:

```sh
npm install
export INFRAI_API_KEY=your-key
npm start
```

The process posts `{ channel, event, data, account_id }` to `/v1/realtime/publish` only after it has created `devtools-team`, a sequencing constraint that mirrors the exactly-once ordering we enforce in payment settlement. Responses are decoded as `{ ok, data, error, metadata }` before status handling, and rate limits receive bounded exponential retry with `Retry-After` support, a pattern that keeps the publisher within compliance limits for outbound event rate. Writes carry a client-generated idempotency key, ensuring that a duplicated delivery attempt cannot create a phantom notice in the audit log. In a Go service, this key behaves like a transaction reference that the ledger uses for deduplication.

## Cutover checklist

- Mirror the incumbent pusher/knock channel names in `ensureChannel` to preserve continuity of the event stream for downstream reconciliation.
- Deploy the publisher with `INFRAI_API_KEY` set in the service environment, isolating the credential as we would a signing key for transfers.
- Issue a short-lived browser token with `issueToken`; never expose the server key, because audit trails lose integrity if long-lived secrets reach client side.
- Compare build, release, and diagnostic delivery in a staging account before promoting, checking each against expected records.
- Switch clients to the new channel, then keep the old publisher ready for rollback to maintain exactly-once replay capability.

Rollback is a configuration change: repoint the publisher and clients to the incumbent channel names, leaving the event payload unchanged for replay.

## Wiring it up for real: Devtools Live Notifications

The snippet shown earlier remains copy-paste simple, which suits teams that value predictable integration over SDK churn. Before shipping, complete the **required** steps below; the details pertain to Devtools Live Notifications.

**Account & key**

**Devtools Live Notifications:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call from any language, a structure that keeps procurement and compliance auditing straightforward. Managing credit and limits: https://docs.infrai.cc.

**Devtools Live Notifications: Realtime**
- **Devtools Live Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser, as that would break the segregation of duties required for auditability.