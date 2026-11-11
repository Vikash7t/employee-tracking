# ADR-004: Attendance State Machine with Hysteresis Exit Grace Periods

## Status
Accepted

## Date
2026-11-10

## Context
Mobile GPS receivers in urban canyons, indoor worksites, or weather interference suffer from continuous multi-path GPS drift (jitter). A worker sitting at a desk near the geofence perimeter may bounce across the virtual boundary dozens of times per hour due to signal variance alone.

A naive binary presence model (`INSIDE` vs `OUTSIDE`) creates devastating user experience issues:
1. **Flapping**: Rapid alternations between inside and outside statuses create dozens of fragmented attendance intervals.
2. **Premature Auto-Clockouts**: Momentary signal degradation causes unfair automatic clockouts.
3. **Admin Alert Fatigue**: Managers receive hundreds of spurious perimeter violation warnings.

## Decision
We implement a **Three-State Presence State Machine with Configurable Hysteresis Grace Periods**:
1. **Presence States**:
   - `INSIDE`: Confirmed location inside authorized worksite polygon/radius.
   - `EXIT_PENDING`: Detected outside perimeter, but active within the worksite hysteresis grace period window (`gracePeriodSeconds`, e.g. 120s–300s).
   - `OUTSIDE`: Grace period expired without re-entry, or explicit employee punch-out outside boundary.
2. **Hysteresis Logic**:
   - When a location event places an employee outside the worksite, the session transitions to `EXIT_PENDING` and sets `exitPendingSince = now()` and `exitGraceExpiresAt = now() + gracePeriodSeconds`.
   - If a subsequent heartbeat places the employee back inside before expiration, the state returns to `INSIDE` and the grace timer is cleared without interval fragmentation.
   - If the timer expires without re-entry, the session closes or flags `OUTSIDE`, recording the elapsed outside time accurately.

## Consequences
### Positive
- **Drift Immunity**: Completely eliminates flapping caused by ambient GPS signal fluctuation.
- **Fair Accounting**: Workers temporarily stepping out to receive a delivery or take a brief phone call do not have their sessions aggressively terminated.
- **Operational Clarity**: Managers can distinguish between transient boundary departures (`EXIT_PENDING`) and prolonged abandonment (`OUTSIDE`).

### Negative / Trade-offs
- Requires background scheduled worker or polling process to evaluate expired grace periods for devices that do not send follow-up heartbeats.

## Verification
- Verified by `apps/backend/verify-phase7-attendance.js` and `tools/offline-simulator/simulate-offline-lifecycle.js`.
