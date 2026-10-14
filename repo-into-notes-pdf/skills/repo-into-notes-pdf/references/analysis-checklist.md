# Analysis checklist

Read the real files `scan.json` lists. For each finding record: **file · what · why it matters · fix**.
These findings become "vs. the repo" callouts and the "bugs fixed" table.

## Everywhere
- Committed `.env`, keys, `node_modules`, build output; several lockfiles; fake packages for Node built-ins (`crypto`, `fs`, `path`).
- Env vars the code reads but `.env`/example never declares; typos in names.
- Secrets or connection strings printed with `console.log`.

## Backend
- Is the auth middleware actually applied to routes? Does it call `next()` / respond on every path?
- Identity taken from `req.body.userId`, query or params instead of the token.
- Passwords hashed (bcrypt/argon2)? `comparePassword` defined? Password excluded from queries and `populate()`?
- Mass assignment: `$set: req.body`, `Model.create(req.body)`, `update(req.body)`.
- Ownership checks on update/delete; admin-only actions gated by role.
- Validation on every body/params/query.
- Error handler leaks `err.stack`; handlers that never respond; `next` used but not declared; missing `await`.
- Schema field names vs. the names the code uses (`Role` vs `role`); model `ref` names vs. registered names.
- Stored counters nobody updates (progress, totals) → compute instead.
- Tokens: JWT in URLs, no expiry, no refresh rotation, one-time tokens stored in clear text, no `state` in OAuth.
- Rate limiting on login / reset / invite. User enumeration in forgot-password.
- Server starts before DB connects; middlewares registered after `listen()`; hard-coded port.

## Realtime
- Socket handshake authenticated? Event payloads trusted for `userId`/`sender`? Room joins checked for membership?
- Global broadcasts of private data; presence stored in DB documents.

## Frontend
- Tokens in localStorage/state; decoding JWTs for auth decisions.
- Refresh interceptor without a queue (parallel 401s → parallel refreshes); infinite refresh loops.
- Middleware checking a short-lived cookie; route lists with typos; `new QueryClient()` in render.
- `useSearchParams` without `<Suspense>`; one-shot effects firing twice in Strict Mode.

## DevOps
- Images running as root, no multi-stage, no `.dockerignore`; `latest` tags.
- Compose: hard-coded passwords, DB port exposed, no healthchecks, obsolete `version:`.
- CI: no tests, no audit, secrets echoed.

## Testing
- `"test": "echo Error"`; no test DB isolation; real emails sent in tests.
