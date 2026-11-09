# MASTER DEVELOPMENT ROADMAP & PHASE-WISE IMPLEMENTATION INSTRUCTIONS
**Project:** Enterprise Workforce Geospatial Attendance & Verification Platform  
**Repository:** employee-tracking  
**Development Approach:** Phased development with explicit stakeholder approval.  
**Current Milestone:** Phase 1 Foundation Completed (as reported on November 9, 2026).  

---

# PART 1 — YOUR RESPONSIBILITY

You are appointed as the Principal Software Architect, Principal Full-Stack Engineer, Mobile Systems Architect, Backend Engineer, Database Architect, Security Engineer, Product Engineer and QA Lead for this project.

Your responsibility is to take the existing Employee Tracking System from its current proof-of-concept state to a complete, reliable, maintainable and demonstrable workforce attendance platform.

You are not simply writing code.

You are responsible for:
- Making technically sound architectural decisions.
- Identifying missing business requirements.
- Researching current technology documentation.
- Designing maintainable data models.
- Building reliable application workflows.
- Protecting employee data.
- Preventing attendance data corruption.
- Ensuring mobile and backend reliability.
- Testing actual application behaviour.
- Maintaining engineering documentation.
- Producing a finished product that demonstrates professional full-stack engineering skills.

Treat this as a serious product development engagement.

Do not optimize for writing the maximum amount of code.

Optimize for reliability, maintainability, security, correctness and product usability.

---

# PART 2 — CURRENT PROJECT STATE

## 2.1 Completed Phase 1

The first development phase has been reported as completed.

The repository now has the following structure:

```text
employee-tracking/
│
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   ├── prisma/
│   │   └── package.json
│   │
│   ├── admin/
│   │   ├── src/
│   │   └── package.json
│   │
│   └── mobile/
│       ├── App.js
│       ├── app.json
│       ├── eas.json
│       └── package.json
│
├── packages/
│   └── contracts/
│
├── database-backups/
├── .github/
├── .env.example
└── package.json
```

Inspect the real repository and preserve its actual structure where appropriate.

Do not assume this structure is perfectly accurate merely because it appears in the completion report.

### Completed backend capabilities
- NestJS application.
- Prisma integration.
- PostgreSQL connectivity.
- PostGIS extension.
- Database health endpoint.
- Organization retrieval.
- Worksite retrieval.
- Spatial distance testing.
- Swagger/OpenAPI documentation.
- Centralized exception handling.

### Completed admin capabilities
- Next.js application.
- Basic navigation shell.
- Health status display.
- Organization and worksite count cards.
- Spatial verification tester.
- TanStack Query.
- Zustand.

### Existing mobile capabilities
- React Native and Expo SDK 53.
- Foreground GPS tracking.
- Background location task.
- Circular geofence logic.
- Exit grace-period logic.
- GPS/network interruption detection.
- Existing standalone APK configuration.

The mobile application was intentionally not modified during Phase 1.

### Database
- PostgreSQL 18.4.
- PostGIS 3.7.0.
- Database: `employee_tracking_dev`.
- Development user: `employee_tracker_app`.

The existing Render MySQL database contains disposable test/demo data.
No migration of MySQL records is required.
Do not make the existing MySQL database a dependency of the new architecture.
Preserve its backup if available, but do not block future development on an optional backup.

### Legacy security containment
The existing Express backend received a local security patch:
- Protected administrative location retrieval.
- Protected location and gap submissions.
- Basic input validation.
- CORS restrictions.
- Rate limiting.

The patch has not been deployed.
Do not deploy the old security patch until you verify whether the existing mobile client sends the required `x-api-key` header.
A shared API key embedded in an APK is not secure authentication.

---

# PART 3 — CONFIRMED TECHNOLOGY FOUNDATION

The developer has selected the following long-term technology foundation.
Do not replace these technologies without a concrete technical reason and stakeholder approval.

## 3.1 Core technologies

| Category | Technology |
|---|---|
| Programming language | TypeScript |
| Web frontend | Next.js App Router |
| UI framework | React |
| Backend framework | NestJS |
| Runtime | Node.js |
| Database | PostgreSQL |
| Geospatial extension | PostGIS |
| ORM | Prisma |
| Authentication | Better Auth |

## 3.2 Mobile technologies
- React Native.
- Expo.
- TypeScript.
- Expo Location.
- Expo Task Manager.
- Expo SQLite.
- Expo SecureStore.
- Expo Router.

The current mobile baseline is Expo SDK 53.
SDK 58 is the proposed upgrade target from the previous architecture review. Verify the currently supported migration path before upgrading.

## 3.3 Admin frontend technologies
- Next.js.
- React.
- TypeScript strict mode.
- Tailwind CSS v4.
- shadcn/ui.
- Lucide React.
- TanStack Query.
- Zustand.
- MapLibre for mapping, subject to tile-provider selection.

## 3.4 Backend supporting technologies
- Swagger / OpenAPI.
- Zod validation.
- Prisma migrations.
- WebSocket Gateway when justified.
- Redis and BullMQ only when genuinely required.

NestJS supports Standard Schema validation, including Zod-based schemas. Prefer shared validation contracts where appropriate rather than maintaining duplicate validation rules in separate applications.

## 3.5 Testing
- Unit testing: Vitest where compatible.
- Backend integration testing: appropriate NestJS testing utilities and Supertest.
- Admin E2E: Playwright.
- Mobile testing: React Native Testing Library and a compatible Expo test environment.
- Physical Android testing: Required for background-location verification.
- API mocking: MSW where useful.

## 3.6 Engineering and deployment
- npm workspaces.
- Git and GitHub.
- GitHub Actions.
- Docker.
- Sentry.
- Pino.
- OpenTelemetry where justified.

Do not install every tool immediately. Introduce technologies when their responsibilities become relevant.

---

# PART 4 — GLOBAL ENGINEERING RULES

These instructions apply to every phase.

## 4.1 Repository inspection
Before starting any phase:
1. Inspect the actual source code.
2. Inspect the current Git state.
3. Inspect package manifests and lockfiles.
4. Inspect the Prisma schema.
5. Inspect current migrations.
6. Inspect relevant API contracts.
7. Inspect existing tests.
8. Identify dependencies on earlier phases.
Do not assume code exists because it was mentioned in an earlier report.

## 4.2 Version management
The Phase 1 report contains multiple version references:
- Admin: Next.js 15.1.7.
- Backend: NestJS 11.
- Prisma: References to versions 6 and 7.
- Mobile: Expo SDK 53.

Before extending the platform:
1. Read every package.json.
2. Read every lockfile.
3. Determine the exact installed versions.
4. Verify compatibility using official documentation.
5. Establish one supported version per application.

Use stable releases unless a specific feature genuinely requires otherwise.
Do not upgrade packages merely because a newer release exists.
Do not mix Prisma ORM major versions within one backend application.
For Prisma ORM 7, use the appropriate Prisma configuration file and PostgreSQL driver adapter. Explicitly generate Prisma Client when required by the current CLI workflow.

## 4.3 Database rules
- Prisma manages ordinary relational database operations.
- PostgreSQL is the authoritative persistent database.
- PostGIS handles spatial operations.
- Use parameterized spatial SQL.
- Use versioned database migrations.
- Never modify production schema manually without documenting the migration.
- Do not use `prisma db push` as a substitute for production migrations.
- Never delete existing data through an unreviewed migration.

The local development account can retain the privileges required for development migrations.
Do not automatically carry local `CREATEDB` or database ownership privileges into production.
Never request database passwords in chat. I will enter credentials locally.
If additional database permissions are required, provide the exact SQL and explain what it does before execution.

## 4.4 Authentication and authorization rules
Authentication and authorization are different responsibilities.
Better Auth manages identity and sessions.
NestJS must enforce application permissions.
Never assume that an authenticated user can access every organization.
Every organization-owned resource must be scoped and authorized by the backend.
Never rely exclusively on frontend checks.

## 4.5 Privacy and location tracking
- Track only for an authorized operational purpose.
- Default location collection to active shifts.
- Make tracking status visible to employees.
- Do not silently track outside scheduled work.
- Never interpret a missing heartbeat automatically as intentional misconduct.
- Record evidence and uncertainty.
- Give employees access to their own attendance history.
- Support attendance dispute and correction workflows.
- Implement configurable location-data retention.

The system must respect Android platform limitations.
Never claim that Expo background tracking can survive every force-stop, device reboot or OEM battery-management condition.

## 4.6 Code organization and file-size standards
Maintain the agreed standards.

| File category | Preferred range |
|---|---:|
| UI components | 100–250 lines |
| Controllers | 50–200 lines |
| Services | 100–300 lines |
| Business logic | 100–300 lines |
| Hooks/utilities | 50–150 lines |

Rules:
- Review files exceeding 300 lines.
- Normally refactor files exceeding 400 lines.
- Files exceeding 600 lines require explicit justification.
- Avoid artificial fragmentation.
- Keep responsibilities cohesive.
- Separate UI from business logic.
- Separate persistence from business rules.
- Keep complex calculations independently testable.

Generated code, package lockfiles and migrations are exempt from ordinary source-file limits.
At the end of every phase report the largest files and any exceptions.

## 4.7 Git safety
Before modifying code:
- Identify the active branch.
- Check working-tree status.
- Identify existing uncommitted changes.
- Check whether the phase depends on another unmerged branch.
- Establish an appropriate branch and PR strategy.

Do not reset, rebase, delete branches, overwrite commits or force-push without approval.
Keep each phase's changes reviewable.
Use conventional commits.

## 4.8 Phase execution and approval
Every phase must have:
1. Pre-phase inspection.
2. Requirements clarification.
3. Proposed implementation plan.
4. Deliverables.
5. Acceptance criteria.
6. Implementation.
7. Testing.
8. Completion report.

Do not start a phase until I approve that phase.
When information is required from me, ask before making assumptions.
Do not ask questions that can be answered by inspecting the repository or official documentation.
Do not ask for passwords or API keys in chat.
Provide clear setup instructions when a human action is necessary.
If a phase has no unresolved stakeholder decisions, state that and proceed after approval rather than manufacturing questions.

---

# PART 5 — PHASE 1.5: FOUNDATION STABILIZATION AND ARCHITECTURE REVIEW

**Status: Required before Phase 2.**

Phase 1 is reported complete. Your first responsibility is to verify that its implementation is correct and ready for further development.
Do not automatically rewrite working code.

## 5.1 Verify the monorepo
Inspect:
- Root npm workspaces.
- Mobile application isolation.
- Backend setup.
- Admin setup.
- Shared contracts.
- Package versions.
- TypeScript configuration.
- Environment variable loading.
- Path aliases.
- Build scripts.
Verify that shared contracts do not import server-only Node.js modules into the mobile application.

## 5.2 Verify the environment
Check:
- PostgreSQL connectivity.
- PostGIS version.
- Prisma connection.
- NestJS health endpoint.
- Next.js application build.
- Shared contract package build.
- Existing Expo project configuration.

Do not expose secrets in output.
Ensure the root environment configuration is actually loaded by Prisma, NestJS and Next.js as intended. A root `.env` file is not automatically guaranteed to be loaded by every workspace application.

## 5.3 Review database identity architecture
The current schema needs a careful review before adding authentication.
Separate:
- Better Auth User.
- Organization.
- Organization Membership.
- Employee Profile.
- Device Installation.

Do not make an employee's global role the source of organization authorization.
An employee may belong to an organization without having a login account yet.
A user may also have membership in more than one organization.
Evaluate Better Auth's Organization plugin versus a custom membership model.
Choose one authoritative organization-membership implementation. Do not create duplicate membership systems.

## 5.4 Review Worksite geospatial schema
The existing Worksite model contains latitude, longitude and radius fields, along with a CIRCULAR/POLYGON enum.
An enum alone does not provide polygon storage.
Prepare a proper PostGIS geometry design for:
- Circular geofences.
- Polygon boundaries.
- Spatial indexes.
- Coordinate reference system.
- Radius and grace-period configuration.

Use custom SQL migrations where Prisma's schema representation requires it.

## 5.5 Verify existing API behaviour
Check:
- HTTP response semantics.
- Input validation.
- Pagination.
- Error handling.
- Tenant scoping.
- Public endpoint exposure.
- Swagger schemas.

The location verification endpoint should return an appropriate success status rather than incorrectly describing a read-only verification as resource creation.
Ensure non-sensitive health checks are the only intentionally public endpoints before authentication is implemented.

## 5.6 Correct misleading technical claims
The existing PostGIS distance query returned approximately 36.53 metres.
The number of decimal places in that result does not prove sub-millimetre physical location accuracy.
Make sure documentation distinguishes numerical calculation precision from GPS measurement accuracy.

## 5.7 Legacy security patch compatibility
Inspect the old mobile application's requests.
Determine whether it provides the `x-api-key` header required by the locally patched Express backend.
Do not deploy the patch if doing so would silently break the existing mobile client.

## Deliverables
- Verified Phase 1 technical report.
- Corrected foundation architecture.
- Final version compatibility matrix.
- Authentication/database relationship proposal.
- Corrected PostGIS storage design.
- List of verified defects.
- Phase 2 readiness report.

**Acceptance criteria:** All foundational applications build, the database works, and outstanding architectural problems have been identified and resolved or explicitly deferred.
Stop and obtain approval before Phase 2.

---

# PART 6 — PHASE 2: AUTHENTICATION, IDENTITY AND MULTI-TENANCY

**Objective:** Implement secure identity and organization-level access control. Use Better Auth and NestJS.

## 6.1 Better Auth integration
Research the current supported Better Auth configuration for:
- Next.js.
- NestJS.
- React Native / Expo.
- Prisma.
- PostgreSQL.

Pay particular attention to adapter maintenance status and version compatibility.
Prefer a reliable NestJS Express integration rather than relying on experimental or unverified adapters.
For the mobile application, verify the Better Auth Expo integration against the actual SDK version before use.
Do not implement a second independent authentication system.

## 6.2 Identity architecture
Separate the following concepts:
- **User**: Represents the authentication identity.
- **Organization**: Represents a customer organization.
- **Organization Membership**: Represents a user's access and role within an organization.
- **Employee Profile**: Represents the person's employment-related information.
- **Device Installation**: Represents a registered installation of the employee mobile application.

Do not confuse employee identity with authentication identity.

## 6.3 Organization roles
Propose an authorization model containing:
- `PLATFORM_ADMIN`
- `ORG_OWNER`
- `ORG_ADMIN`
- `MANAGER`
- `EMPLOYEE`

Platform-level permissions must be distinct from organization-specific permissions.
Managers should have access only to their assigned organization and permitted workforce.
Where team or worksite-level access is needed, implement explicit assignment-based authorization.
Use Better Auth's Organization plugin where appropriate, provided it can be integrated without duplicating application membership records.

## 6.4 Authentication workflows
Implement:
- Registration or administrator-provisioned employee accounts, according to the approved business policy.
- Login.
- Logout.
- Session persistence.
- Session expiration.
- Session revocation.
- Password reset.
- Email verification if email-based authentication is selected.
- Mobile session restoration.
- Secure token/cookie storage.
- Unauthorized request handling.

Support the appropriate authentication experience for the employee mobile app and admin web portal.
Do not assume that browser cookie handling and native mobile authentication are identical.

## 6.5 Device registration
Implement installation-based device registration.
Generate an application installation identifier.
Support:
- Device registration.
- Device model and OS information.
- Registration timestamp.
- Active/revoked status.
- Device replacement request.
- Manager/admin revocation.

Do not claim that a software-generated installation UUID is impossible to clone or manipulate.
Device binding reduces casual account sharing; it does not eliminate all proxy-attendance fraud.

## 6.6 Security controls
Implement:
- Auth guards.
- Organization authorization guards.
- Resource ownership validation.
- Rate limiting.
- Request validation.
- Secure cookie/token handling.
- Session revocation.
- Device revocation.
- Login error handling.

## 6.7 Tests
Test:
- Valid login.
- Invalid credentials.
- Revoked session.
- Expired session.
- Unauthorized endpoint access.
- Cross-tenant data access.
- Unauthorized organization switching.
- Employee role restrictions.
- Manager permissions.
- Device replacement and revocation.

## Stakeholder input required
Before starting, ask me to confirm:
1. Whether employees will use email/password, phone OTP or administrator-generated credentials.
2. Whether organizations create employee accounts through invitations or administrators manually provision them.
3. Whether users can belong to multiple organizations.
4. Whether managers are restricted to assigned teams or can access the entire organization.
Recommend sensible defaults and explain the trade-offs.
Do not purchase an email or SMS service without approval.

## Acceptance criteria
- Authentication works in the selected clients.
- Organization authorization is enforced server-side.
- Device registration works.
- Unauthenticated access is denied.
- Cross-tenant access tests pass.
- Existing anonymous mobile architecture is not accidentally made unusable.
Stop and report before Phase 3.

---

# PART 7 — PHASE 3: ORGANIZATION, WORKFORCE, WORKSITE AND SHIFT MANAGEMENT

**Objective:** Build the workforce configuration domain.

## 7.1 Organization management
Implement:
- Organization profile.
- Organization timezone.
- Organization status.
- Organization settings.
- Membership management.
- Organization-scoped resources.

## 7.2 Employee management
Implement:
- Employee creation.
- Employee update.
- Employee activation/deactivation.
- Employee code.
- Employee profile.
- Contact information.
- Department/team assignment where approved.
- Worksite assignment.
- Shift assignment.
- Device relationships.

Employee codes must be unique within an organization, not necessarily globally. Use appropriate database constraints.

## 7.3 Worksite management
Implement:
- Worksite creation.
- Worksite editing.
- Worksite activation/deactivation.
- Address.
- Coordinates.
- Worksite type.
- Configurable radius.
- Configurable exit grace period.
- Assigned employees.
- Worksite timezone where needed.

Support both:
- **Circular geofence**: Defined by latitude, longitude and radius.
- **Polygon geofence**: Defined by a geographical boundary.

## 7.4 PostGIS implementation
Use appropriate geography/geometry types and SRID 4326 where applicable.
Implement:
- `ST_DWithin` for circular distance checks.
- `ST_Covers` for polygon boundary inclusion.
- GiST indexes.
- Parameterized SQL.
- Spatial input validation.
- Spatial query tests.

PostGIS spatial queries must execute on the backend. Do not trust frontend-calculated geofence results.

## 7.5 Accuracy-aware geofence evaluation
Every location observation should include available:
- Latitude.
- Longitude.
- Horizontal accuracy.
- Device timestamp.
- Location provider.
- Mock-location signal, if available.

Design three geofence outcomes:
- `INSIDE`
- `OUTSIDE`
- `UNCERTAIN`

For a circular boundary, account for reported GPS uncertainty:
- If `distance + accuracy <= radius`, classify as `INSIDE`.
- If `distance - accuracy > radius`, classify as `OUTSIDE`.
- Otherwise classify as `UNCERTAIN`.

This is an operational rule, not a guarantee of the physical location.
Also implement:
- Hysteresis.
- Minimum consecutive observations.
- Configurable grace periods.
- Protection against GPS drift.
- Stale location detection.
Do not create a confirmed breach from one inaccurate location fix.

## 7.6 Shift configuration
Implement:
- Shift templates.
- Shift start/end time.
- Allowed late-arrival grace.
- Break policies.
- Overnight shifts.
- Scheduled workdays.
- Shift assignments.
- Employee/worksite assignment compatibility.

Store timestamps in UTC and apply the organization's IANA timezone for local attendance rules and presentation.

## Stakeholder input required
Ask me to confirm:
1. Default circular geofence radius (prototype used 30m, Phase 1 seed used 50m).
2. Default exit grace period (prototype used 120s).
3. Whether polygon geofences are required in the first complete release.
4. Whether we initially support fixed shifts, flexible shifts or both.
5. Whether overnight shifts and scheduled breaks are required for the first release.
Implement configurable policies rather than hardcoded business values.

## Acceptance criteria
- Organizations and employees can be managed.
- Worksites can be created and assigned.
- Circular geofences work.
- Polygon geofences work when enabled.
- Spatial indexes are verified.
- Shift assignments are valid.
- Cross-tenant access is prevented.
Stop and report before Phase 4.

---

# PART 8 — PHASE 4: ATTENDANCE DOMAIN ENGINE AND STATE MACHINE

**Objective:** Replace the prototype's scattered booleans, timers and temporary variables with deterministic attendance business logic.

## 8.1 Separate the concepts
Do not create one enormous state enum that combines attendance, geofence, connection and review status. Model separate dimensions:

### Attendance session lifecycle
- `NOT_STARTED`
- `ACTIVE`
- `COMPLETED`
- `CANCELLED`

### Workplace presence
- `INSIDE`
- `EXIT_PENDING`
- `OUTSIDE`
- `UNCERTAIN`

### Connectivity/device observation
- `ONLINE`
- `NETWORK_INTERRUPTED`
- `GPS_DISABLED`
- `LOCATION_UNAVAILABLE`
- `UNKNOWN`

### Review status
- `NOT_REQUIRED`
- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `RESOLVED`

Break periods should be represented as attendance intervals/events, not merely as a replacement for workplace-presence state.

## 8.2 Attendance events
Create a properly defined event model:
- `PUNCH_IN_REQUESTED`
- `PUNCH_IN_ACCEPTED`
- `PUNCH_IN_REJECTED`
- `LOCATION_OBSERVED`
- `GEOFENCE_EXIT_DETECTED`
- `EXIT_GRACE_STARTED`
- `EXIT_CONFIRMED`
- `GEOFENCE_REENTRY`
- `CONNECTIVITY_GAP_OPENED`
- `CONNECTIVITY_GAP_CLOSED`
- `PUNCH_OUT_REQUESTED`
- `PUNCH_OUT_ACCEPTED`
- `ATTENDANCE_ADJUSTED`

Use a clearly documented event vocabulary. Do not mutate old historical events to represent new events.

## 8.3 Separate evidence from calculated records
Keep three logical data layers:
1. **Raw observations**: What the device actually reported.
2. **Attendance events**: The validated business events derived from observations and employee actions.
3. **Attendance summaries**: The calculated attendance result.
This prevents corrections and policy changes from destroying historical evidence.

## 8.4 Exit grace-period engine
Implement:
1. Employee is inside the worksite.
2. A location sample suggests an exit.
3. System checks GPS accuracy.
4. System enters `EXIT_PENDING`.
5. Grace-period deadline is persisted.
6. New location samples are evaluated.
7. Re-entry before expiry cancels the pending exit.
8. Continuous verified exit past the deadline produces an exit event.
9. Re-entry creates a separate return event.

The implementation must survive process restarts because the deadline and state are persisted. Do not use an in-memory `setTimeout` as the only source of truth.

## 8.5 Attendance calculation engine
Calculate:
- Scheduled start/end.
- Actual clock-in/out.
- Late arrival / early departure.
- Inside-worksite intervals.
- Confirmed outside-worksite intervals.
- Approved breaks.
- Missing-punch status.
- Unresolved connectivity intervals.
- Total recorded attendance duration.

Handle overnight shifts, midnight boundaries, missing timestamps, duplicate events, out-of-order events, incomplete sessions, manual corrections, and organization timezones. Never silently convert uncertain evidence into a payroll deduction.

## 8.6 Attendance correction model
Managers must not silently overwrite original attendance timestamps.
Use a separate correction record containing:
- Original value.
- Corrected value.
- Reason.
- Requested by.
- Approved by.
- Timestamp.
- Related attendance session.
Retain the original event history.

## 8.7 Tests
Build extensive unit tests for the state machine and calculation engine (all 15 required scenarios).

## Acceptance criteria
Deterministic results from validated events and policy configuration. Independently testable without UI. Stop and report before Phase 5.

---

# PART 9 — PHASE 5: MOBILE APPLICATION RESTRUCTURING AND MODERNIZATION

**Objective:** Turn the existing mobile prototype into a maintainable employee application without losing its useful tracking functionality.

## 9.1 Preserve existing functionality
Record current application behaviour, APK baseline, and EAS configuration. Preserve existing functionality until replacement behaviour is verified. Do not rewrite everything in one operation.

## 9.2 Convert to TypeScript
Gradually migrate JavaScript source files to TypeScript with strict type checking.

## 9.3 Feature-based architecture
Target structure:
```text
apps/mobile/
│
├── src/
│   ├── app/
│   ├── features/
│   │   ├── authentication/
│   │   ├── attendance/
│   │   ├── location/
│   │   ├── geofencing/
│   │   ├── shifts/
│   │   ├── devices/
│   │   └── synchronization/
│   ├── database/
│   ├── services/
│   ├── components/
│   ├── hooks/
│   ├── store/
│   └── shared/
├── app.json
└── package.json
```
Background task definitions must be registered at the root module level (`index.js`).

## 9.4 Dependency cleanup
Remove accidental mobile dependencies (`mysql2`, `dot-env`).

## 9.5 Expo upgrade
Verify the intermediate upgrade path. Target currently verified stable SDK compatible with native requirements (proposed target SDK 58). Use Expo Doctor. Test EAS preview APKs at each important stage.

## 9.6 Location permissions and background service
Verify foreground location permission, background location permission, Android foreground-service permissions, and location foreground-service type (`FOREGROUND_SERVICE_LOCATION` on API 34+). Inspect generated `AndroidManifest.xml`. Never request permissions without explaining their purpose to the employee.

## 9.7 Battery optimization
Design adaptive location sampling (lower-frequency balanced updates when stationary inside; higher-frequency near boundary; high accuracy during punch events). Measure on physical devices.

## 9.8 Application lifecycle
Persist background state. Handle application relaunch, JS runtime recreation, tracking restart, permission changes, app upgrades, reboot recovery, and OEM restrictions.

## 9.9 Mobile user interface
Build: Login, dashboard, active shift, clock-in/out, location status, tracking indicator, sync status, timeline, and history.

## Stakeholder input required
Actual Android device models/versions available for testing; EAS account info; BYOD vs company-owned.

## Acceptance criteria
TypeScript conversion works; Expo builds; core tracking preserved; permissions verified in native build; physical device tests documented. Stop and report before Phase 6.

---

# PART 10 — PHASE 6: OFFLINE-FIRST EVENT QUEUE AND SYNCHRONIZATION ENGINE

**Objective:** Make attendance recording reliable when internet connectivity is unavailable.

## 10.1 Local storage
Use Expo SQLite as persistent local database. Use SecureStore for credentials. Do not store attendance event queues in AsyncStorage. Local tables: attendance sessions, attendance events, location observations, connectivity incidents, pending synchronization. Use database transactions.

## 10.2 Event identity and sequencing
Every event contains: client UUIDv7, device installation ID, session ID, event type, device sequence number, device occurrence timestamp, location evidence, schema version, sync status.

## 10.3 Backend event ingestion
Batch API: `POST /api/v1/attendance/events/batch` with idempotency, sequence validation, duplicate handling, and partial batch acknowledgements.

## 10.4 Synchronization lifecycle
Local event created $\rightarrow$ SQLite persisted $\rightarrow$ Pending $\rightarrow$ Online $\rightarrow$ Batch submitted $\rightarrow$ Backend commits $\rightarrow$ Per-event acknowledgement $\rightarrow$ Marked synchronized. Never remove local events before backend acknowledgement is persisted.

## 10.5 Retry system
Exponential backoff with jitter. Handle internet loss, server errors, expired auth, partial batches, out-of-order delivery, and restarts.

## 10.6 Backend reconciliation
Deterministic reconstruction from late-arriving offline events. Record server receipt time, preserve original event identity, detect conflicts, create exceptions when ambiguous.

## 10.7 Offline simulation
Automated tests for all 11 required scenarios (15 min, 1 hr, 4 hrs offline, clock change, out-of-order, reboot, etc.).

## Acceptance criteria
Pending events survive restart; no dropped events; retries do not duplicate; reconciliation deterministic; physical device limitations documented. Stop and report before Phase 7.

---

# PART 11 — PHASE 7: NEXT.JS ADMIN AND MANAGER OPERATIONS PORTAL

**Objective:** Build a complete administration interface using Next.js, React 19, Tailwind CSS v4, shadcn/ui, Lucide React, TanStack Query, and Zustand.

## 11.1 Overall design & 11.2 Navigation
Professional operations dashboard with role-based navigation: Overview, Organization, Workforce, Worksites, Shifts, Attendance, Reports, Audit Logs, Settings.

## 11.3 Dashboard overview & 11.4 Live map
MapLibre live map with worksite markers, circular overlays, polygon boundaries, employee markers, accuracy indicators, and last observation timestamp. Start with 15–30s polling before considering WebSockets.

## 11.5–11.9 Management modules
Build employee management, map-based worksite/geofence editor, shift management, attendance timeline, loading skeletons, empty states, error boundaries, and accessible forms.

## Acceptance criteria
Admin auth works; role-specific navigation; API-driven dashboard; map renders; shifts/worksites managed; stale data tagged; responsive layouts verified. Stop and report before Phase 8.

---

# PART 12 — PHASE 8: EXCEPTIONS, AUDIT LOGGING AND REPORTING

**Objective:** Make attendance records useful to real operations managers.

## 12.1 Exception management & 12.2 Manager review workflow
Structured exceptions for missing punches, uncertain geofences, breaches, GPS/network gaps, and calculation inconsistencies. Manager review workflow with audit comments.

## 12.3 Audit history
Chronological history recording action type, actor, organization, target entity, timestamp, before/after values, and session links. Protect against routine modification.

## 12.4 Attendance reports & 12.5 Export
Daily report, Employee report, Worksite report, Shift report, Exception report. CSV export with formula injection protection (`=`, `+`, `-`, `@` sanitization).

## Stakeholder input required
Attendance retention duration; location retention duration; correction-request workflow policy; report format priorities.

## Acceptance criteria
Exceptions reviewed; corrections preserve history; reports reconcile with events; CSV exports correct and sanitized; cross-org access blocked; managerial changes audited. Stop and report before Phase 9.

---

# PART 13 — PHASE 9: SECURITY, PRIVACY, RELIABILITY AND QUALITY ASSURANCE

**Objective:** Verify the entire platform as an integrated system.

## 13.1–13.3 Security, API & Privacy
Authz/auth testing, cross-tenant isolation tests, rate limiting, SQL injection checks, Indian DPDP Act compliance (shift-bound tracking, visible status, retention limits).

## 13.4 Mobile reliability
Physical Android device testing covering all 14 required lifecycle scenarios.

## 13.5 Automated test suites
Unit tests, PostgreSQL/PostGIS integration tests, Playwright admin E2E tests, and mobile offline queue tests.

## 13.6 Performance testing
Benchmark latency, spatial queries, batch ingestion, battery consumption, and memory usage.

## Acceptance criteria
Zero unresolved critical vulnerabilities; business workflows pass; tenant isolation verified; migrations reproducible; automated tests pass. Stop and report before Phase 10.

---

# PART 14 — PHASE 10: DEPLOYMENT, CI/CD AND OBSERVABILITY

**Objective:** Prepare a reliable deployable system.

## 14.1 Environment separation & 14.2 Docker
Local development, staging, production with separated credentials. Containerization configuration.

## 14.3 Database deployment & 14.4 CI/CD
Prisma versioned migration deployment pipelines. GitHub Actions for linting, type checks, backend/admin builds, and unit/integration tests.

## 14.5 Observability & 14.6 Deployment decisions
Pino structured logging, correlation IDs, Sentry error tracking, database health monitoring. Hosting evaluation (Render, etc.).

## Acceptance criteria
Reproducible build pipeline; staging deployment verified; migrations execute safely; backups tested; secrets protected; production deployment approved. Stop and report before Phase 11.

---

# PART 15 — PHASE 11: PORTFOLIO QUALITY AND RECRUITER PRESENTATION

**Objective:** Turn the completed engineering work into a project that demonstrates professional development skills.

## 15.1 Synthetic demonstration environment
20 fictional employees, 3 worksites, multiple shifts, device registrations, and attendance sessions.

## 15.2 Offline Failure Simulator
Development/demo simulator showing clock-in/out, geofence exit, GPS/network drop, duplicate submission, and time skew with controlled playback.

## 15.3 Technical documentation & ADRs
Comprehensive documentation in `docs/` and Architecture Decision Records (`ADR-001` through `ADR-006`).

## 15.4–15.6 README, demo materials & evidence
Full GitHub README, architectural diagrams, ER diagrams, state-machine diagrams, and measured benchmarks.

## Acceptance criteria
Recruiter can understand project in under 2 minutes, run from README, and inspect working offline/geospatial workflows.

---

# PART 16 — CROSS-PHASE PRODUCT REQUIREMENTS

## 16.1–16.4 Roles & Experience
Employee mobile UX, manager operations UX, organization administration, and strict separation of platform administration from customer organizations.

## 16.5 API contracts & 16.6 Architecture boundaries
Versioned `/api/v1` contracts with shared Zod schemas. Modular monolith architecture. Transactional outbox pattern for asynchronous event delivery.

---

# PART 17 — STAKEHOLDER QUESTIONS AND SETUP REQUIREMENTS

## 17.1 Before each phase
Inspect repository and environment first. Ask only unresolved requirements.

## 17.2 Questions by phase
Authentication method, employee provisioning policy, geofence radius, grace periods, shift rules, device testing availability, map provider, retention limits, email/SMS provider.

## 17.3 Installation guidance
Provide Windows PowerShell instructions with official links. Never ask for secrets in chat.

---

# PART 18 — REQUIRED PHASE COMPLETION REPORT

Every phase completion report must follow the 16-point standard:
1. Objective
2. Actual implementation
3. Architecture decisions
4. Files created
5. Files modified
6. Files deleted
7. Dependencies
8. Database changes
9. API changes
10. Testing (build, unit, integration, E2E, physical)
11. Code quality (line counts, limits, circular dependencies, TypeScript errors)
12. Security
13. Setup requirements
14. Known issues
15. Next phase
16. Approval status

---

# PART 19 — FINAL EXECUTION INSTRUCTIONS

This is a complete product roadmap. Understand the entire roadmap before implementing individual phases. Implementation must happen in controlled stages.

## Starting point
Phase 1 has been reported complete. Therefore, begin with:

**PHASE 1.5: FOUNDATION STABILIZATION AND ARCHITECTURE REVIEW.**

First inspect the actual repository and reconcile the Phase 1 report with the current files.
Do not recreate functionality that already exists and works.
Do not automatically upgrade framework versions.
Do not introduce new infrastructure unnecessarily.
Stop and obtain approval before Phase 2.
