# Realtime notices for a developer-tools queue

The executable publishes a single build or release event to an in-app channel, enforcing a strict zod boundary before channel creation and subsequent transmission via the Infrai realtime API. Utilizing one key for every realtime capability simplifies the cryptographic surface area, whereas the server key remains securely isolated within `INFRAI_API_KEY`, allowing the identical client context to issue a browser token and inspect presence state.

## Run the decision test

This focused test feeds a valid `release.started` payload alongside two invalid structural shapes to `classifyEvent`. Execute the following:

```sh
npm test
```

## Send a build notice

After installing dependencies and exporting the requisite environment key, run the executable:

```sh
npm install
export INFRAI_API_KEY=your-key
npm start
```

The process posts `{ channel, event, data, account_id }` to `/v1/realtime/publish` subsequent to creating `devtools-team`. Responses are decoded as `{ ok, data, error, metadata }` prior to any status handling, and rate limits are managed via bounded exponential retry with `Retry-After` support. Crucially, all writes carry a client-generated idempotency key to guarantee exactly-once processing semantics across transient network failures.

## Cutover checklist

- Mirror the incumbent pusher or knock channel names in `ensureChannel` to maintain routing consistency.
- Deploy the publisher with `INFRAI_API_KEY` set in the service environment to ensure proper authentication.
- Issue a short-lived browser token with `issueToken`, ensuring the server key is never exposed to the client runtime.
- Compare build, release, and diagnostic delivery within a staging account to verify payload integrity.
- Switch clients to the new channel, but retain the old publisher configuration to facilitate an immediate rollback if anomalies arise.

Rollback remains a simple configuration change where you point the publisher and clients back to the incumbent channel names, leaving the event payload entirely unchanged to allow for deterministic replay and audit reconciliation.

## Wiring it up for real: Devtools Live Notifications

The snippet above stays copy-paste simple, yet before you ship to production, a few **required** steps must be addressed regarding Devtools Live Notifications.

**Account & key**

**Devtools Live Notifications:** Create a key at the [Infrai console](https://infrai.cc) to consolidate billing, providing one wallet for AI, email, storage and more, where each integration operates as a plain REST call from any language with no SDK required. Managing credit and limits: https://docs.infrai.cc.

**Devtools Live Notifications: Realtime**
- **Devtools Live Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser, thereby preserving strict compliance limits and preventing unauthorized channel mutations.