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
export type MembershipRole = 'OWNER' | 'ORG_ADMIN' | 'MANAGER' | 'MEMBER';
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

export type GeoPolygonCoordinates = number[][][]; // GeoJSON Polygon: [ [ [lng, lat], ... ] ]

export interface WorksiteDto {
  id: string;
  organizationId: string;
  name: string;
  worksiteType: WorksiteType;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  polygonCoordinates?: GeoPolygonCoordinates | null;
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
  polygonCoordinates?: GeoPolygonCoordinates | null;
  gracePeriodSeconds?: number;
}

export interface UpdateWorksiteInput {
  name?: string;
  worksiteType?: WorksiteType;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  polygonCoordinates?: GeoPolygonCoordinates | null;
  gracePeriodSeconds?: number;
  isActive?: boolean;
}

export interface VerifyPresenceInput {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
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

// 5. Identity & Multi-Tenant DTOs
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
}

export interface OrganizationMembershipDto {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  isActive: boolean;
  worksiteScopes?: string[];
  departmentScopes?: string[];
  createdAt: string;
}

export interface EmployeeProfileDto {
  id: string;
  organizationId: string;
  userId?: string | null;
  membershipId?: string | null;
  employeeCode: string;
  fullName: string;
  department?: string | null;
  primaryWorksiteId?: string | null;
  isActive: boolean;
  isLockedOut: boolean;
  createdAt: string;
  updatedAt: string;
}

// 6. Device Registration DTOs
export interface DeviceBindingDto {
  id: string;
  employeeProfileId: string;
  deviceId: string;
  deviceModel?: string | null;
  osVersion?: string | null;
  isTrusted: boolean;
  registeredAt: string;
  lastSeenAt: string;
}

// 7. Authentication & Provisioning Inputs/Outputs
export interface EmployeeLoginInput {
  organizationSlug: string;
  employeeCode: string;
  password: string;
  deviceId?: string;
  deviceModel?: string;
  osVersion?: string;
}

export interface EmployeeLoginResponse {
  token: string;
  user: UserDto;
  organization: OrganizationDto;
  membership: OrganizationMembershipDto;
  employeeProfile: EmployeeProfileDto;
  deviceBinding?: DeviceBindingDto;
  deviceSecret?: string;
}

export interface VerifyPinInput {
  pin: string;
  deviceId: string;
  deviceSecret: string;
}

export interface ProvisionEmployeeInput {
  organizationId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department?: string;
  primaryWorksiteId?: string;
}

export interface ProvisionEmployeeResponse {
  employeeProfile: EmployeeProfileDto;
  invitationToken: string;
  invitationUrl: string;
  expiresAt: string;
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
  pin?: string;
  fullName?: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  userId: string;
  organizationId: string;
  employeeProfileId: string;
}

export interface SessionValidationDto {
  userId: string;
  organizationId: string;
  role: MembershipRole;
  employeeProfileId?: string;
}
