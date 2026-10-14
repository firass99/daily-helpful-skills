# Outline catalogue

Pick only the Parts the project needs, in build order. Number steps continuously across Parts.
Always start with **Overview** and end with **Reference**.

| Part | Colour key | Hex |
|---|---|---|
| Overview | `overview` | `#64748b` |
| Backend | `backend` | `#2563eb` |
| Frontend | `frontend` | `#7c3aed` |
| Mobile | `mobile` | `#0891b2` |
| Database | `database` | `#0d9488` |
| Security | `security` | `#059669` |
| DevOps | `devops` | `#d97706` |
| Testing | `testing` | `#db2777` |
| Reference | `reference` | `#475569` |

## Overview
What it is (1 paragraph) · architecture diagram (ASCII) · concept map table (concept / how the repo does it / where) ·
tech stack + versions table · domain model diagram · folder structure: current vs. recommended (group by feature module).

## Backend
setup (deps, scripts, .gitignore) → env validated at startup (Zod or equivalent) → logger + DB connection →
**every model** → core utils (errors, error handler, validation) → authentication (create, sign, deliver, verify,
refresh, revoke) → authorization (roles table + ownership helpers) → one step per business module
(schemas → service → routes) → integrations (mail, uploads, payments, queues, realtime) → app bootstrap + server →
curl tests + route table → backend lifecycle cheat table.

## Frontend
setup + feature folders → talking to the API (rewrites/proxy, cookies) → token handling do/don't table →
HTTP client (+ refresh queue) → types + API layer → providers / layout → state ("which state goes where" table) →
hooks per feature → forms → route protection (middleware/proxy, guards, roles) → main pages →
logout / sessions / tab sync → frontend lifecycle cheat table.

## Mobile
navigation · secure storage · API client · auth flow · offline/state · build & release.

## Database
schema design · relations · indexes · migrations · seeding · queries · transactions · performance.

## Security
threat model · OWASP Top 10 mapping table (area / in the repo / severity / fix) · authn · authz · input validation ·
XSS/CSRF/SQLi/SSRF · headers/CSP · CORS · cookies · rate limiting · secrets (rotation + history purge) ·
dependency audit · logging · hardening checklist.

## DevOps
Dockerfile multi-stage, non-root (per service) + .dockerignore → compose (dev override + prod) → env & secrets →
reverse proxy (Nginx/Caddy, WebSocket upgrade) → CI (lint, test, audit, build, push) → deploy targets table →
TLS/domains → logs, monitoring, backups → rollback → commands.

## Testing
setup (in-memory DB, mocks) · unit · integration (Supertest) · e2e (Playwright) · one test per bug fixed · CI.

## Reference
bugs fixed vs. the repo (problem / severity / fix) · old routes → new routes · env vars table (name / value / secret?) ·
commands · version notes (e.g. Next 15 → 16: `middleware.ts` → `proxy.ts`).

## Topic mode (no repo)
Invent a small, realistic example project that exercises the topic; same Parts, skip "vs. the repo" callouts,
add a "common mistakes" table instead.
