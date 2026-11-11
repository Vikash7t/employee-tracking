# ADR-003: Client-Side Offline Event Journaling & Deterministic Batch Sync

## Status
Accepted

## Date
2026-11-10

## Context
Mobile workforce field personnel frequently operate in areas with intermittent or zero cellular connectivity (e.g., basements, subways, industrial warehouses, remote construction sites).

Traditional synchronous HTTP POST requests fail catastrophically under these conditions:
1. **Data Loss**: Punches fail when offline, resulting in unrecorded labor hours and payroll disputes.
2. **Race Conditions & Duplication**: Automatic network retries cause multiple duplicate records if connection drops after server receipt but before client response acknowledgment.
3. **Out-of-Order Clock Events**: Reconnected requests arriving out of chronological order corrupt attendance session calculations.
4. **Tampering & Time Forgery**: Users manipulating device clock time can falsify attendance records when offline.

## Decision
We implement an **Append-Only Offline Event Journal** on mobile devices combined with an **Idempotent Batch Reconciliation Engine** on the backend:
1. **Local SQLite Journal**: Every mobile action (`PUNCH_IN`, `LOCATION_HEARTBEAT`, `PUNCH_OUT`) is written immediately to a persistent local SQLite table with an incremental `sequenceNumber`, a client UUID, and a monotonic timestamp.
2. **Cryptographic Chaining**: Events are signed with an HMAC-SHA256 signature calculated from the device secret and previous event signature, preventing local record alteration.
3. **Exponential Backoff Batch Push**: A background network listener initiates bulk sync via `POST /api/v1/sync/events` when connectivity is restored, sending ordered event batches with retry backoff and jitter.
4. **Server Idempotency Table**: The backend indexes `[organization_id, id]`. Any previously ingested event ID is silently skipped with `{ processed: 0, duplicates: N }`, rendering replay attacks completely harmless.
5. **Deterministic Event Playback**: Ingested events are replayed in chronological order (`clientTimestamp` ascending) against the attendance state machine.

## Consequences
### Positive
- **Zero Data Loss**: Field workers can clock in/out indefinitely without an active internet connection; data persists locally and syncs automatically upon reconnection.
- **Idempotency Guarantee**: Identical batch transmissions produce identical system state without duplicate sessions or duplicate intervals.
- **Auditability**: Complete chronological audit trail preserved from mobile event creation to server ledger commit.

### Negative / Trade-offs
- Mobile clients must maintain SQLite storage and handle migrations across app updates.
- Server reconciliation must handle clock skew between mobile devices and server NTP time.

## Verification
- Verified end-to-end by `tools/offline-simulator/simulate-offline-lifecycle.js` and `apps/backend/verify-phase6-sync.js`.
