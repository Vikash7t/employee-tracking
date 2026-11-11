# ADR-002: Decoupled Global Identity and Multi-Tenant RBAC

## Status
Accepted

## Date
2026-11-10

## Context
Enterprise workforce management platforms require multi-tenancy where a single individual (such as a contractor, auditor, or field worker) may work across multiple distinct tenant organizations.

Conflating user credentials (email, password hash, PIN) directly with organization employee records causes critical architectural failures:
1. **Credential Duplication**: Users must manage separate login credentials for each organization.
2. **Privilege Escalation**: Organization-level permissions risk leaking across tenant boundaries if not explicitly scoped.
3. **Data Pollution**: Deactivating an employee in one organization must never revoke their identity or historical records in another.

## Decision
We decouple user authentication from organization authorization into three orthogonal entities:
1. **`User` (Global Identity)**: Manages global credentials (`email`, `passwordHash`, `pinHash`), device lockout state, and MFA tokens. Holds no organization-specific authority.
2. **`OrganizationMembership` (RBAC Anchor)**: Explicit relation linking a `User` to an `Organization` with a strictly defined role (`OWNER`, `ADMIN`, `MANAGER`, `MEMBER`).
3. **`EmployeeProfile` (Tenant Employment Contract)**: Organization-scoped domain profile containing `employeeCode`, `department`, `primaryWorksiteId`, assigned shifts, and registered device bindings.

All requests pass through NestJS guards (`JwtAuthGuard`, `RolesGuard`, `OrgTenantGuard`) extracting `organizationId` from authenticated claims and rejecting cross-tenant operations.

## Consequences
### Positive
- **Strict Multi-Tenant Isolation**: Tenant data is physically and logically partitioned by `organizationId`. Cross-tenant data leakage is architecturally prohibited.
- **Flexible Role Progression**: A user can act as an `ADMIN` in Organization A while being a regular `MEMBER` (field employee) in Organization B.
- **Independent Lifecycle Management**: An employee profile can be archived or suspended without affecting the underlying user's account in other organizations.

### Negative / Trade-offs
- Requires joins or multi-step lookups during authentication to resolve active organization membership and employee profile.
- Adds schema complexity with composite unique constraints (e.g., `@@unique([organizationId, employeeCode])`).

## Verification
- Enforced across all API endpoints with NestJS guards and validated via `apps/backend/verify-phase2-rbac.js` and `verify-phase3-auth.js`.
