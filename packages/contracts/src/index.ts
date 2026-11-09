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

// 8. Offline Event Journal & Sync DTOs
export type AttendanceEventType =
  | 'PUNCH_IN_REQUESTED'
  | 'PUNCH_IN_ACCEPTED'
  | 'PUNCH_IN_REJECTED'
  | 'LOCATION_OBSERVED'
  | 'GEOFENCE_EXIT_DETECTED'
  | 'EXIT_GRACE_STARTED'
  | 'EXIT_CONFIRMED'
  | 'GEOFENCE_REENTRY'
  | 'CONNECTIVITY_GAP_OPENED'
  | 'CONNECTIVITY_GAP_CLOSED'
  | 'PUNCH_OUT_REQUESTED'
  | 'PUNCH_OUT_ACCEPTED'
  | 'ATTENDANCE_ADJUSTED';

export interface AttendanceEventDto {
  eventId: string;
  organizationId: string;
  employeeProfileId: string;
  eventType: AttendanceEventType;
  sequenceNumber: number;
  clientTimestamp: string;
  elapsedRealtimeMs?: number;
  payload: Record<string, any>;
  signature?: string;
}

export interface SyncBatchInput {
  events: AttendanceEventDto[];
}

export interface SyncBatchResponse {
  acknowledgedEventIds: string[];
  rejectedEvents: {
    eventId: string;
    reason: string;
  }[];
}

// 9. Attendance Session & State Machine DTOs
export type AttendanceSessionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type WorkplacePresenceStatus = 'INSIDE' | 'EXIT_PENDING' | 'OUTSIDE' | 'UNCERTAIN';
export type AttendanceReviewStatus = 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type AttendanceIntervalType = 'INSIDE' | 'OUTSIDE' | 'BREAK';

export interface AttendanceIntervalDto {
  id: string;
  attendanceSessionId: string;
  intervalType: AttendanceIntervalType;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
}

export interface AttendanceSessionDto {
  id: string;
  organizationId: string;
  employeeProfileId: string;
  worksiteId: string;
  status: AttendanceSessionStatus;
  presenceStatus: WorkplacePresenceStatus;
  reviewStatus: AttendanceReviewStatus;
  clockInAt: string;
  clockOutAt?: string | null;
  exitPendingSince?: string | null;
  exitGraceExpiresAt?: string | null;
  insideDurationSeconds: number;
  outsideDurationSeconds: number;
  breakDurationSeconds: number;
  autoClockedOut: boolean;
  shiftTemplateId?: string | null;
  isLate?: boolean;
  isEarlyDeparture?: boolean;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  intervals?: AttendanceIntervalDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PunchInInput {
  worksiteId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  clientTimestamp?: string;
  elapsedRealtimeMs?: number;
  isMocked?: boolean;
}

export interface PunchOutInput {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  clientTimestamp?: string;
  elapsedRealtimeMs?: number;
  isMocked?: boolean;
}

export interface PunchResultDto {
  success: boolean;
  session?: AttendanceSessionDto;
  reason?: string;
}

// 10. Shift & Break Orchestration DTOs
export interface ShiftTemplateDto {
  id: string;
  organizationId: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  isOvernight: boolean;
  lateArrivalGraceMin: number;
  earlyExitGraceMin: number;
  breakAllowanceMin: number;
  isFlexible: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreateShiftTemplateInput {
  organizationId: string;
  name: string;
  startTime: string;
  endTime: string;
  lateArrivalGraceMin?: number;
  earlyExitGraceMin?: number;
  breakAllowanceMin?: number;
  isFlexible?: boolean;
}

export interface ShiftAssignmentDto {
  id: string;
  organizationId: string;
  employeeProfileId: string;
  shiftTemplateId: string;
  workDays: number[]; // [1..7]
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  shiftTemplate?: ShiftTemplateDto;
  createdAt: string;
}

export interface AssignShiftInput {
  organizationId: string;
  employeeProfileId: string;
  shiftTemplateId: string;
  workDays: number[];
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface AttendanceVarianceDto {
  sessionId: string;
  isLate: boolean;
  latenessMinutes: number;
  isEarlyDeparture: boolean;
  earlyDepartureMinutes: number;
  scheduledDurationMinutes: number;
  actualDurationMinutes: number;
}

