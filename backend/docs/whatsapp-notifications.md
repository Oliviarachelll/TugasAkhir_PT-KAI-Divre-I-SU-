# WhatsApp notifications and recovery tokens

This service uses Baileys only as the WhatsApp transport. Application code does
not send directly to Baileys: it writes an encrypted `NotificationJob` to the
database, and a worker later claims and sends that job.

## Security model

- Password-reset and report-unlock tokens use the human-readable format
  `XXXX-XXXX-XXXX-XXXX` (80 bits from a Crockford Base32 alphabet).
- The plaintext token exists only while the message is being created and sent.
  The token table stores an HMAC-SHA256 digest, not the plaintext value.
- Notification text is encrypted at rest with AES-256-GCM.
- Jobs use stable deduplication keys to prevent repeated API or scheduler calls
  from creating the same notification.
- A successful Baileys `sendMessage` call is stored as `ACCEPTED`. It must not be
  presented as `DELIVERED` unless a separate, trustworthy delivery receipt has
  updated the job.
- The public health endpoints do not expose transport or pairing state.
- Socket.IO `/dashboard` connections require a valid JWT whose
  `session_version` still matches the database account. Rooms are selected by
  the server from the stored role and unit; clients cannot join arbitrary rooms.
- Raw pairing QR values are never relayed through Socket.IO or returned by an
  API. When explicitly enabled, authenticated admins can request a short-lived,
  server-rendered PNG data URL with cache prevention headers.

## Required configuration

Set secrets through the deployment secret manager, not in source control.
Use independent random values for each secret in production.

| Variable | Purpose | Production guidance |
| --- | --- | --- |
| `JWT_SECRET` | Signs application sessions and serves as a backwards-compatible fallback for the two secrets below | Required; use a high-entropy secret |
| `TOKEN_PEPPER` | HMAC key for reset and unlock token digests | Required in production; use a different secret from `JWT_SECRET` |
| `NOTIFICATION_ENCRYPTION_KEY` | Source key material for AES-256-GCM notification payload encryption | Required in production; use a different secret from `JWT_SECRET` |
| `ENABLE_WHATSAPP` | Enables the Baileys transport and all notification runtime components | Set to `true` only on the designated WhatsApp owner process |
| `ENABLE_NOTIFICATION_WORKER` | Starts the durable outbox worker when WhatsApp is enabled | Normally `true` on the WhatsApp owner |
| `ENABLE_NOTIFICATION_SCHEDULER` | Starts the 08:00 and 16:00 Asia/Jakarta scheduler when WhatsApp is enabled | Enable on one process only |
| `WA_SESSION_PATH` | Directory containing Baileys credentials | Use a persistent, access-restricted volume; default is `./whatsapp-session` |
| `WA_SHOW_QR_IN_TERMINAL` | Renders a pairing QR in the server terminal | Keep `false`; enable temporarily only in a trusted operator session |
| `WA_EMIT_RAW_QR` | Emits a raw QR event inside the backend process | Keep `false`; the application intentionally does not expose it to clients |
| `WA_WEB_QR_ENABLED` | Allows authenticated `IT`/`ADMIN_GLOBAL` users to render the current pairing QR on the notification page | Default `false`; enable only for controlled pairing operations |
| `WA_WEB_QR_TTL_MS` | Maximum in-memory lifetime of one web pairing QR | Default `60000`, bounded to 10–120 seconds; the QR is also cleared on connect, disconnect, or shutdown |
| `WA_WEB_VERSION` | Optional emergency override in `major.minor.revision` form | Normally leave unset so the service uses Baileys' maintainer-recommended version; set only during a documented protocol incident |
| `WA_VERSION_LOOKUP_TIMEOUT_MS` | Maximum startup wait for the maintainer version lookup | Default `5000`; the bundled package version is used if lookup fails |
| `SOCKET_SESSION_REVALIDATE_MS` | Interval for reloading connected Socket.IO users and checking lock/session/role state | Default `60000`; values below 1000 ms fall back to the default |

Generate secret material with an approved password/secret generator. For
example, a 32-byte random value encoded as Base64 is sufficient input key
material. Do not print these values in logs or support tickets.

### Secret rotation

Changing `TOKEN_PEPPER` invalidates every outstanding reset/unlock token.
Changing `NOTIFICATION_ENCRYPTION_KEY` makes existing encrypted outbox payloads
unreadable. Before rotating the encryption key, drain or explicitly expire all
active jobs, or implement a versioned key migration. Never rotate it silently
while jobs are pending.

## Retry, polling, and rate settings

All values are milliseconds.

| Variable | Default | Meaning |
| --- | ---: | --- |
| `NOTIFICATION_POLL_INTERVAL_MS` | `5000` | Delay between worker scans |
| `NOTIFICATION_RATE_LIMIT_MS` | `1000` | Minimum delay between send attempts in one worker batch |
| `NOTIFICATION_RETRY_BASE_MS` | `5000` | Initial exponential-backoff base |
| `NOTIFICATION_RETRY_MAX_MS` | `1800000` | Maximum retry delay (30 minutes) |
| `NOTIFICATION_STALE_LOCK_MS` | `300000` | Age after which an abandoned processing lock can be reclaimed |
| `WA_RECONNECT_BASE_MS` | `1000` | Initial Baileys reconnect-backoff base |
| `WA_RECONNECT_MAX_MS` | `30000` | Maximum Baileys reconnect delay |
| `AUTH_CONTACT_RATE_WINDOW_MS` | `900000` | Window for failed self-service contact-change attempts |
| `AUTH_CONTACT_RATE_LIMIT` | `10` | Maximum failed contact-change attempts per IP in one window |

A job defaults to five attempts. Permanent validation failures are not retried;
transient transport failures are retried with bounded exponential backoff and
jitter until attempts or expiry are exhausted.

## Single Baileys session owner

Only one running process may own a given `WA_SESSION_PATH` and WhatsApp account.
Do not mount the same session directory into multiple active containers or
processes. Concurrent Baileys owners can replace one another's connection,
corrupt session state, or cause duplicate/blocked traffic.

The database outbox supports safe claiming by multiple workers, but this does
not make a Baileys session safe to share. A recommended multi-instance layout is:

1. API replicas with `ENABLE_WHATSAPP=false` (they can still enqueue jobs).
2. One designated notification process with all three enable flags set to
   `true` and a persistent `WA_SESSION_PATH`.
3. One scheduler owner. Do not enable the scheduler on every API replica.

The recovery endpoint rate limiter currently uses process-local memory. A
multi-instance API deployment must configure a shared limiter store (for
example Redis) before relying on the limit as a cluster-wide control.

## Migration and deployment

The notification security migration intentionally invalidates legacy active
plaintext reset tokens and clears legacy plaintext report-unlock tokens.
Communicate this before deployment: users with an old token must request a new
one. Legacy notification templates are classified using their previous runtime
rules: names containing `REVISI`/`DITOLAK` become revision templates,
`PENGINGAT*` becomes deadline templates, and the remainder become broadcasts.
Only canonical scopes (`SEMUA`, `PUSAT`, `DAERAH`, `CABANG`) and triggers are
kept scheduled. An unknown legacy scope or trigger is converted to
`SEMUA` + `MANUAL` + `BROADCAST`; keeping it manual prevents a malformed legacy
row from silently sending to a wider audience.

Production deployment:

```sh
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm test
npm start
```

Development deployment can use `npx prisma migrate dev`, but production must use
`npx prisma migrate deploy` so migration history remains deterministic.

Suggested rollout order:

1. Back up the database and stop the old WhatsApp owner.
2. Configure the secrets and persistent session volume.
3. Apply the migration and generate Prisma Client.
4. Start API replicas with WhatsApp disabled.
5. Start exactly one WhatsApp owner and complete pairing from its trusted
   terminal if required.
6. Verify `/api/wacloud/status`, `/api/wacloud/metrics`, and
   `/api/wacloud/logs` using an authenticated `IT` or `ADMIN_GLOBAL` account.

## Outbox statuses

| Status | Operational meaning |
| --- | --- |
| `PENDING` | Stored and waiting for its first eligible attempt |
| `PROCESSING` | Claimed by one worker; a lock owner and lock time are present |
| `RETRY` | A retryable attempt failed and `next_attempt_at` is scheduled |
| `ACCEPTED` | Baileys accepted the send operation and returned, optionally with a provider message ID; this is not proof of delivery |
| `DELIVERED` | A trustworthy delivery update confirmed delivery; current Baileys send acceptance alone does not set this state |
| `FAILED` | A permanent error occurred or the maximum attempts were exhausted |
| `EXPIRED` | The job reached its expiry before a successful acceptance |

`pending + processing + retry` is the active durable queue depth. A non-zero
`staleLocks` count indicates workers terminated while holding jobs; those jobs
become reclaimable after `NOTIFICATION_STALE_LOCK_MS`. If an operator repeats a
request whose matching job is already `FAILED` or `EXPIRED`, the service uses a
compare-and-swap update to reset and requeue that same job; active or successful
jobs remain idempotent duplicates.

## Registering notification recipients

Notification recipients come from `Pengguna.no_hp`; there is no separate phone
field on `Unit`. This keeps reminders and security messages attached to an
accountable user instead of an anonymous unit record.

- `IT` or `ADMIN_GLOBAL` can set the initial number when creating or editing an
  account in `/manajemen/user`.
- A signed-in user can update their own number in `/settings`. The endpoint only
  permits changing `no_hp` and requires the current account password.
- Inputs such as `0812 3456 7890`, `6281234567890`, and `+62 812-3456-7890`
  are normalized to the canonical `6281234567890` form. Invalid or non-Indonesian
  numbers are rejected before persistence.
- Changing the number invalidates outstanding password-reset tokens and writes an
  audit event without including either the old or new raw number in audit detail.
- Unit deadline reminders target every `USER_UNIT` account in that unit with a
  valid number (duplicate canonical numbers are collapsed). Report review notices
  target the account that created the report. Helpdesk notices target the ticket
  requester or assigned administrative recipients according to the workflow.
- A missing or invalid number is skipped rather than guessed or silently routed to
  another account. Operators should confirm that the entered number is active and
  belongs to the intended recipient.

## Pairing procedure

1. Ensure every other process using this WhatsApp account is stopped.
2. Choose one trusted display channel:
   - terminal: set `WA_SHOW_QR_IN_TERMINAL=true`; or
   - authenticated web UI: set `WA_WEB_QR_ENABLED=true`, sign in as `IT` or
     `ADMIN_GLOBAL`, and open `/notifikasi`.
3. Start the designated owner and scan the QR with the authorized device.
4. Confirm the status changes to `connected`; the in-memory QR is cleared
   immediately.
5. Disable the pairing display flag that is no longer needed and restart through
   the normal deployment mechanism.

The rendered QR is equivalent to a temporary account credential. Never expose
the terminal through a public stream, paste QR text into chat, make the pairing
route public, or cache its response. Treat the session directory as a credential.

## Monitoring and incident handling

- Alert on sustained `RETRY`, increasing `FAILED`/`EXPIRED`, non-zero stale
  locks, or a transport state of `logged_out`.
- `backoff` means reconnect is scheduled and is normally transient.
- `logged_out`, `badSession`, or `connectionReplaced` requires operator action.
- Repeated registration failure `405` before a QR is emitted usually indicates a
  rejected WhatsApp Web protocol version. Upgrade Baileys first; do not keep
  deleting an already-empty session directory. Use `WA_WEB_VERSION` only as a
  temporary, documented override.
- Baileys' raw transport logger is silent by default because handshake logs can
  contain pairing material. Application logs expose only sanitized status codes.
- Logs and API responses must contain only redacted phone numbers and stable
  error codes; do not add plaintext payload or token logging while debugging.
- If the encryption key is unavailable or wrong, stop the worker and repair the
  configuration. Do not delete jobs merely to silence errors.
- `ACCEPTED` jobs should be reported as provider-accepted, not delivered.

The authenticated notification endpoints return queue outcomes with
`queued`, `duplicate`, `failed`, and `skipped` counts. HTTP `202` means all
accepted recipients were queued or deduplicated; `207` means a partial outcome.
A green UI success must not be shown when `failed` or `skipped` is non-zero.
