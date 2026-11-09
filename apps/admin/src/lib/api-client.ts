import {
  HealthCheckResponse,
  OrganizationDto,
  WorksiteDto,
} from '@employee-tracking/contracts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Health check failed with status: ${res.status}`);
  return res.json();
}

export async function fetchOrganizations(): Promise<OrganizationDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/organizations`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch organizations: ${res.status}`);
  return res.json();
}

export async function fetchWorksites(): Promise<WorksiteDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/worksites`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch worksites: ${res.status}`);
  return res.json();
}
