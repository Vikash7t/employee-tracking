import {
  HealthCheckResponse,
  OrganizationDto,
  WorksiteDto,
  CreateWorksiteInput,
  AttendanceSessionDto,
  EmployeeProfileDto,
} from '@employee-tracking/contracts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Health check failed with status: ${res.status}`);
  return res.json();
}

export async function fetchOrganizations(token?: string | null): Promise<OrganizationDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations`, {
    headers: getHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch organizations: ${res.status}`);
  return res.json();
}

export async function fetchWorksites(token?: string | null): Promise<WorksiteDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/worksites`, {
    headers: getHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch worksites: ${res.status}`);
  return res.json();
}

export async function createWorksite(
  input: CreateWorksiteInput,
  token?: string | null,
): Promise<WorksiteDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/worksites`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `Failed to create worksite: ${res.status}`);
  }
  return res.json();
}

export async function fetchAttendanceHistory(
  token?: string | null,
  limit: number = 50,
): Promise<AttendanceSessionDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/attendance/history?limit=${limit}`, {
    headers: getHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch attendance history: ${res.status}`);
  return res.json();
}

export async function fetchEmployees(token?: string | null): Promise<EmployeeProfileDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/employees`, {
    headers: getHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch employees: ${res.status}`);
  return res.json();
}
