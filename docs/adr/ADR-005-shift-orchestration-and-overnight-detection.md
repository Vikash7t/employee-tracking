# ADR-005: Shift Schedule Orchestration and Overnight Midnight Crossing Detection

## Status
Accepted

## Date
2026-11-10

## Context
Commercial, medical, manufacturing, and security operations frequently run 24/7 rotating shifts. A significant portion of workforce shifts cross midnight (e.g., 22:00 to 06:00).

Standard naive time arithmetic (`diff = clock_out - clock_in`) causes multiple calculation failures when applied across midnight:
1. **Negative Duration Calculations**: Simple subtraction yields negative durations or 24-hour wrap errors.
2. **Shift Attribution Failure**: A punch at 01:00 AM on Tuesday belongs to Monday night's shift, not Tuesday's day shift.
3. **Variance Evaluation Errors**: Lateness and early departure calculations evaluate against the wrong calendar day, generating erroneous disciplinary flags.

## Decision
We implement a **Shift Orchestration Engine with Explicit Overnight Flagging and Normalized Time Window Projection**:
1. **Schema Support**: `ShiftTemplate` includes `isOvernight: Boolean`, `lateArrivalGraceMin: Int`, `earlyExitGraceMin: Int`, and `breakAllowanceMin: Int`.
2. **Normalized Window Projection**: When evaluating an attendance session against an assigned shift:
   - For standard shifts (`isOvernight: false`), scheduled window is `[Date + startTime, Date + endTime]`.
   - For overnight shifts (`isOvernight: true`), scheduled window is `[Date + startTime, (Date + 1 day) + endTime]`.
3. **Dynamic Shift Assignment**: Punch events are matched to the closest active scheduled shift assignment taking overnight window bounds and employee working days into account.
4. **Variance Classification**:
   - `isLate = (clockInAt > scheduledStart + lateArrivalGraceMin)`
   - `isEarlyDeparture = (clockOutAt < scheduledEnd - earlyExitGraceMin)`

## Consequences
### Positive
- **Midnight Boundary Correctness**: Overnight shifts are calculated without arithmetic wrap or day attribution bugs.
- **Accurate Payroll Variance**: Lateness and early departures reflect true operational rules with customizable per-shift grace tolerances.
- **Flexible Staffing Models**: Supports rotating shifts, fixed shifts, and flexible time windows.

### Negative / Trade-offs
- Timezone awareness is mandatory: Shifts must be computed in the organization's configured IANA timezone (`Asia/Kolkata`, `America/New_York`, etc.) rather than server UTC.

## Verification
- Validated via `apps/backend/verify-phase8-shifts.js` covering overnight schedule evaluation (22:00–06:00) and variance calculations.
