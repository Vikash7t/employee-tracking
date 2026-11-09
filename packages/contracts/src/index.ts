/**
 * @file packages/contracts/src/index.ts
 * Core shared contracts, DTOs, and types for Employee Tracking System.
 */

// 1. Health & System Status
export interface DatabaseHealthStatus {
  connected: boolean;
  postgisInstalled: boolean;
  postgisVersion?: string;
  latencyMs?: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  database: DatabaseHealthStatus;
}

// 2. Roles & Permissions
export type UserRole = 'PLATFORM_ADMIN' | 'ORG_OWNER' | 'ORG_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type WorksiteType = 'CIRCULAR' | 'POLYGON';

// 3. Organization DTOs
export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  timezone?: string;
}

// 4. Worksite & Geospatial DTOs
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface WorksiteDto {
  id: string;
  organizationId: string;
  name: string;
  worksiteType: WorksiteType;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  gracePeriodSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorksiteInput {
  organizationId: string;
  name: string;
  worksiteType?: WorksiteType;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  gracePeriodSeconds?: number;
}

export type GeofencePresenceOutcome = 'INSIDE' | 'OUTSIDE' | 'UNCERTAIN';

export interface SpatialDistanceCheck {
  worksiteId: string;
  distanceMeters: number;
  outcome: GeofencePresenceOutcome;
  isInside: boolean;
  accuracyMeters?: number;
  isAccuracyAcceptable: boolean;
}

// 5. Employee & Identity DTOs
export interface EmployeeDto {
  id: string;
  organizationId: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  department?: string;
  primaryWorksiteId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 6. Device Registration DTOs
export interface DeviceBindingDto {
  id: string;
  employeeProfileId: string;
  deviceId: string;
  deviceModel?: string;
  osVersion?: string;
  isTrusted: boolean;
  registeredAt: string;
}
