# Bliss production runbook

This is the shortest path from a clean checkout to a production-ready Bliss
deployment. Product and architecture intent remain in `PRD.md`, `DESIGN.md`,
and `docs/AGENTIC-SYSTEM-DESIGN.md`.

## 1. Required services

| Capability | Required configuration |
|---|---|
| Core app | PostgreSQL, Clerk, `WEB_URL`, `NEXT_PUBLIC_API_URL` |
| AI decisions | `AGENT_MODEL_PROVIDER` plus the selected provider's API key and model |
| Operations | strong independent `CRON_SECRET` and `OPS_SECRET` |
| Private Moment photos | private S3/R2 bucket and all `MEDIA_S3_*` variables |
| Photographer search | `VENDOR_SEARCH_ENDPOINT`, `VENDOR_SEARCH_TOKEN` |
| Verified license rules | `LEGAL_AUTHORITY_ENDPOINT`, `LEGAL_AUTHORITY_TOKEN` |
| Email sending | `EMAIL_SEND_ENDPOINT`, `EMAIL_SEND_TOKEN` |

The provider-backed features fail closed when their configuration is absent.
They do not substitute model memory, fake results, or a local write.

Set `AGENT_MODEL_PROVIDER=gemini` with `GEMINI_API_KEY` and `GEMINI_MODEL`, or
set it to `anthropic` with `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. Gemini is
the default in `.env.example`; Anthropic remains available as a fallback.

Set `NODE_ENV=production`. Non-production mode intentionally uses a development
identity and relaxes wedding membership checks; it must never be used on a public
deployment.

## 2. Private media setup

The object bucket must remain private. Give the API credential only `GetObject`,
`PutObject`, and `DeleteObject` permissions for the configured bucket/prefix.
Bucket CORS must allow `PUT` from `WEB_URL` with `Content-Type` and
`If-None-Match`; do not allow a wildcard production origin.

The API issues:

- a 15-minute wedding-scoped conditional PUT that cannot overwrite an object;
- a five-minute read URL only after membership is checked;
- an authenticated object deletion when a user removes a photo;
- cleanup of expired unattached uploads through the media cron.

## 3. Provider gateway contracts

Bliss talks to narrow internal gateways rather than giving the model provider
credentials or raw MCP access:

- vendor search: bounded `POST` query and at most eight normalized candidates;
- legal authority: state/county query and a fully sourced, fresh government rule;
- email: exact approved payload plus the stable action ID as `Idempotency-Key`.

The executable schemas are the source of truth:

- `apps/api/src/agent/providers/vendor-search.ts`
- `apps/api/src/agent/providers/legal-authority.ts`
- `apps/api/src/agent/providers/email-send.ts`

All production gateway URLs must use HTTPS.

## 4. Deploy order

```bash
bun install --frozen-lockfile
bun run test
bun run lint:i18n
bun run type-check
bun run eval:agent
bun run build
bun run db:migrate
```

Then deploy the API, verify `GET /health`, and deploy the web app. Configure the
Clerk webhook as `POST /auth/webhook` before inviting real users.

## 5. Scheduled workers

Call these endpoints with `Authorization: Bearer <CRON_SECRET>`:

| Endpoint | Recommended frequency | Purpose |
|---|---:|---|
| `POST /internal/cron/reminders` | every minute | fire due in-app reminders |
| `POST /internal/cron/external-actions` | every minute | execute and retry approved email sends |
| `POST /internal/cron/media-uploads` | every 15 minutes | delete expired unattached uploads |

Workers are safe to call repeatedly. Email retries retain the same action ID;
media deletion is idempotent.

## 6. Release and incident controls

Send `X-Ops-Key: <OPS_SECRET>` to the Ops endpoints:

- `GET /ops/agent/summary?days=7` for bundle/model reliability, latency, cost,
  and product feedback;
- `GET /ops/agent/runs/:runId` for a privacy-redacted trace;
- `POST /ops/agent/deployments` for stable or sticky-canary activation;
- `POST /ops/agent/rollback` to restore a known bundle;
- `POST /ops/agent/controls` for global, pack, or capability kill switches.

Before a release, run the real-database checks:

```bash
bun run verify:generation
bun run smoke:agent
bun run smoke:photographer
bun run smoke:scoping
bun run smoke:couple
bun run smoke:release
bun run smoke:model
```

If model quality regresses, stop the affected pack or capability first, restore
the last passing immutable bundle, then mine the failed traces into a versioned
eval case before re-release.
