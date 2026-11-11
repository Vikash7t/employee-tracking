# ADR-001: PostGIS Geospatial Verification vs In-Memory Haversine Math

## Status
Accepted

## Date
2026-11-10

## Context
Mobile workforce attendance verification requires authoritative determination of whether an employee is physically located within an authorized worksite perimeter at the exact time of clock-in, clock-out, or periodic location heartbeats.

Initial implementations frequently rely on client-side or application-level in-memory Haversine formulas. However, this approach exhibits severe enterprise limitations:
1. **Spherical Simplification**: The Haversine formula models Earth as a perfect sphere, introducing spatial distortion (up to 0.5% error) compared to the WGS84 ellipsoidal spheroid.
2. **Complex Geometries**: Circular radius checks cannot represent real-world irregularly shaped campuses, warehouses, construction sites, or multi-wing facilities.
3. **Client-Side Spoofing**: Trusting client-computed geofence checks exposes the system to GPS mocking and modified APK injection attacks.
4. **Query Performance**: Filtering thousands of mobile coordinates against worksite perimeters in application memory requires full-table scans with $O(N \times M)$ overhead.

## Decision
We mandate PostgreSQL with the **PostGIS 3.5** spatial extension as the authoritative geospatial evaluation engine for all worksite validation:
- Circular worksites are evaluated via `ST_DWithin(worksite.geog, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radiusMeters)`.
- Irregular campus boundaries are stored as closed `POLYGON` geometries and evaluated via `ST_Contains(worksite.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))`.
- All spatial coordinates are indexed using Generalized Search Trees (`GIST`) to achieve logarithmic $O(\log N)$ spatial query performance.

## Consequences
### Positive
- **Authoritative Ellipsoidal Precision**: Uses geodesic distance calculations over the true WGS84 spheroid with millimeter-level mathematical correctness.
- **Arbitrary Geometry Support**: Seamlessly supports concave polygons, campuses, corridors, and multi-polygon perimeters.
- **Zero Client Trust**: All presence decisions occur server-side; client GPS coordinates are treated as untrusted claims subjected to database verification.
- **Sub-Millisecond Execution**: PostGIS spatial indexing scales to millions of location events without memory pressure on the Node.js backend.

### Negative / Trade-offs
- Requires PostGIS extension enabled in PostgreSQL container images (`postgis/postgis:16-3.5-alpine`).
- Developers must use parameterized SQL (`$queryRaw`) for spatial predicate execution as standard ORMs (Prisma) lack native PostGIS geometric types.

## Verification
- Verified via automated test suite `apps/backend/verify-phase4-postgis.js` testing exact circular perimeter bounds, polygon inclusion, and exterior rejection.
