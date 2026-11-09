# GeoTrack Enterprise — Geospatial Workforce & Attendance Platform

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.7-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![NestJS 11](https://img.shields.io/badge/NestJS-11.0.1-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18.4-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.7.0-green?style=flat-square&logo=postgis)](https://postgis.net/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4.0-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

> A mission-critical, offline-first geospatial workforce tracking and automated attendance verification engine. Designed to eliminate GPS drift false-breaches, guarantee deterministic shift reconciliation, and enforce strict multi-tenant privacy boundaries.

---

## 🌟 Key Architectural Pillars

- 🛰️ **PostGIS Geodesic Spatial Engine:** Powered by native PostgreSQL 18.4 and PostGIS 3.7.0. Executes true ellipsoidal distance measurements on the WGS 84 spheroid (`ST_DWithin`, `ST_Distance`) with SP-GiST indexing, replacing inaccurate flat-Earth approximations.
- 🛡️ **3-Zone GPS Accuracy Geofencing:** Mathematically decouples coordinate precision from physical hardware sensor uncertainty ($E_{\text{acc}}$). Employs conservative three-zone boundary classification (`INSIDE`, `OUTSIDE`, `UNCERTAIN`) with automatic jitter dampening and strict coordinate rejection when $E_{\text{acc}} > 50\text{m}$.
- 🔄 **Offline-First Event Synchronization:** Deterministic mobile event journal queueing with exponential backoff and randomized jitter. Guarantees immutable event identity, sequence validation, and late-arriving event reconciliation without fabricating timestamps.
- 🏢 **Multi-Tenant Decoupled Identity:** Clean separation of concerns between core User credentials (Better Auth), Organization tenancy (`OWNER`, `ORG_ADMIN`, `MANAGER`, `MEMBER`), Workforce Persona (`EmployeeProfile`), and Hardware Biometrics (`DeviceBinding`).
- 📱 **Zero-Downtime Legacy Transition:** Dual-mode API key gateway containment preventing field outages for existing mobile APKs while transitioning to modern monorepo micro-services.
- 📊 **Real-time Operations Command Center:** High-performance Next.js 15 App Router administration dashboard with MapLibre vector geofencing, circular and polygon worksite management, live worker tracking, and audited exception reviews.

---

## 📁 Monorepo Structure

GeoTrack Enterprise is architected as an `npm` workspaces monorepo:

```
employee-tracking/
├── apps/
│   ├── backend/                 # Enterprise NestJS 11/12 service (Port 4000)
│   │   ├── src/health/          # PostGIS & database health checks (/api/v1/health)
│   │   ├── src/spatial/         # Geodesic calculation engine & PostGIS adapter
│   │   ├── src/organization/    # Multi-tenant organization & membership logic
│   │   ├── src/worksite/        # Geofence boundary verification & radius audits
│   │   └── prisma/              # Schema definitions, PostGIS extensions, & migrations
│   ├── admin/                   # Next.js 15.1.7 App Router portal (Port 3000)
│   │   ├── src/app/             # Dashboard layouts, routes, and error boundaries
│   │   ├── src/components/      # Navigation shell, spatial testing sandbox, health badges
│   │   └── src/store/           # TanStack Query v5 + Zustand state stores
│   └── mobile/                  # React Native / Expo tracking client (Android/iOS)
│       ├── src/tracking/        # Foreground service & battery-optimized location loop
│       └── src/sync/            # SQLite offline event journal & retry machine
├── packages/
│   └── contracts/               # Pure TypeScript shared domain models (@employee-tracking/contracts)
│       └── src/index.ts         # DTOs, spatial verification schemas, & event definitions
├── gps-backend/                 # Legacy Express containment proxy (gradual deprecation)
└── MASTER_PLAN.md               # Definitive 19-part engineering master blueprint
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** `>= 20.x` (Tested on `v22.x`)
- **npm:** `>= 10.x`
- **PostgreSQL:** `16+` or `18.4` with **PostGIS 3.5+** or **3.7.0** extension installed

### 1. Database Setup
Create the target database and grant extension permissions:
```sql
CREATE DATABASE employee_tracking_dev;
\c employee_tracking_dev;
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 2. Environment Configuration
Create a `.env` file in the repository root:
```env
DATABASE_URL="postgresql://<USER>:<PASSWORD>@localhost:5432/employee_tracking_dev?schema=public"
PORT=4000
NODE_ENV=development
ENFORCE_CLIENT_API_KEY=false
LEGACY_BACKEND_PORT=5000
```

### 3. Installation & Database Sync
```bash
# Install dependencies across all monorepo workspaces
npm install

# Build shared contracts package
npm run build --workspace=@employee-tracking/contracts

# Push Prisma schema to PostgreSQL & generate client
npm run prisma:generate --workspace=@employee-tracking/backend
npx prisma db push --schema=apps/backend/prisma/schema.prisma
```

### 4. Running the Development Servers
Launch the backend and admin dashboard:
```bash
# Terminal 1: NestJS API & PostGIS Gateway (http://localhost:4000/api/docs)
npm run start:dev --workspace=@employee-tracking/backend

# Terminal 2: Next.js Admin Command Center (http://localhost:3000)
npm run dev --workspace=@employee-tracking/admin
```

### 5. Verification & Health Probes
```bash
# Verify database connection and PostGIS extension
curl http://localhost:4000/api/v1/health

# Verify geodesic presence calculation (ST_DWithin)
curl -X POST http://localhost:4000/api/v1/worksites/<WORKSITE_ID>/verify-presence \
  -H "Content-Type: application/json" \
  -d '{"latitude": 12.9716, "longitude": 77.5946, "accuracyMeters": 15}'
```

---

## 📊 Phased Development Roadmap

| Phase | Milestone Description | Status | Deliverables & Pull Requests |
| :--- | :--- | :---: | :--- |
| **Phase 0** | Legacy Audit & Containment | ✅ Complete | Zero-downtime dual-mode API key gating on `gps-backend` ([`6a5d7d1`](https://github.com/Vikash7t/employee-tracking/commit/6a5d7d1)) |
| **Phase 1** | Monorepo & PostGIS Engine | ✅ Merged | NestJS 11, Next.js 15, PostGIS 3.7.0, `@employee-tracking/contracts` ([PR #5](https://github.com/Vikash7t/employee-tracking/pull/5)) |
| **Phase 1.5** | Foundation Stabilization | ✅ Merged | 3-zone GPS accuracy model, REST semantics, Master Roadmap ([`b070c88`](https://github.com/Vikash7t/employee-tracking/commit/b070c88)) |
| **Phase 2** | Decoupled Identity & Better Auth | ✅ Complete | Multi-tenant memberships, role-based access, single-use invitations, device binding |
| **Phase 3** | Worksite Geofence Engine | ✅ Complete | Circular & polygon geofencing, PostGIS point-in-polygon, OWASP Top 10 security |
| **Phase 4** | Mobile Foreground Service | 📋 Planned | Android sticky notification, battery-efficient adaptive GPS polling |
| **Phase 5** | Offline SQLite Event Journal | 📋 Planned | Client-side queue, exponential backoff, sequence integrity engine |
| **Phase 6** | Attendance State Machine | 📋 Planned | Deterministic session lifecycle, auto-punch out, exception auditing |
| **Phase 7** | MapLibre Live Command Center | 📋 Planned | Vector geofence rendering, employee markers, cluster inspection |
| **Phase 8** | Shift & Break Orchestration | 📋 Planned | Shift templates, grace periods, overnight shift handling |
| **Phase 9** | Audited Reports & CSV Stream | 📋 Planned | Timezone-aware timesheets, formula injection protection, exports |
| **Phase 10** | Enterprise Hardening & CI/CD | 📋 Planned | GitHub Actions, migration backups, Docker packaging, OWASP audits |

---

## 🛡️ Security & Reliability Standards

- **Hardware Uncertainty Protection:** Rejects low-accuracy GPS readings to guarantee legal and operational integrity of attendance records.
- **Strict Multi-Tenant Isolation:** Database records and spatial queries are always scoped by `organizationId`, preventing cross-tenant data exposure.
- **OWASP API Security:** Structured DTO input validation, strict rate limiting, CORS origin isolation, and parameterized SQL queries through Prisma.
- **Zero Hardcoded Secrets:** Environment configuration strictly separated between local development, staging, and production tiers.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
