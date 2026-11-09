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
export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MANAGER' | 'EMPLOYEE';

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

export interface SpatialDistanceCheck {
  worksiteId: string;
  distanceMeters: number;
  isInside: boolean;
  accuracyMeters?: number;
}

// 5. Employee DTOs
export interface EmployeeDto {
  id: string;
  organizationId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeInput {
  organizationId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  role?: UserRole;
}

// 6. Device Registration DTOs
export interface DeviceBindingDto {
  id: string;
  employeeId: string;
  deviceId: string;
  deviceModel?: string;
  osVersion?: string;
  isTrusted: boolean;
  registeredAt: string;
}
