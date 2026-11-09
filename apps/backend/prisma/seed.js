const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Phase 2 decoupled multi-tenant identity...');

  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Operations Ltd',
      slug: 'acme-corp',
      timezone: 'Asia/Kolkata',
      isActive: true,
    },
  });

  const site = await prisma.worksite.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: org.id,
      name: 'Bengaluru Central Office',
      worksiteType: 'CIRCULAR',
      latitude: 12.9857016,
      longitude: 77.5979309,
      radiusMeters: 50,
      gracePeriodSeconds: 120,
      isActive: true,
    },
  });

  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('Password123!', saltRounds);
  const employeePasswordHash = await bcrypt.hash('EmployeePass123!', saltRounds);
  const employeePinHash = await bcrypt.hash('1234', saltRounds);

  // 1. Seed Owner User & Membership
  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@acme.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'owner@acme.com',
      fullName: 'Alice Owner',
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: ownerUser.id,
      },
    },
    update: { role: 'OWNER' },
    create: {
      organizationId: org.id,
      userId: ownerUser.id,
      role: 'OWNER',
    },
  });

  // 2. Seed Manager User, Membership & Worksite Scope
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@acme.com' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'manager@acme.com',
      fullName: 'Bob Manager',
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  const managerMembership = await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: managerUser.id,
      },
    },
    update: { role: 'MANAGER' },
    create: {
      organizationId: org.id,
      userId: managerUser.id,
      role: 'MANAGER',
    },
  });

  await prisma.managerWorksiteScope.upsert({
    where: {
      membershipId_worksiteId: {
        membershipId: managerMembership.id,
        worksiteId: site.id,
      },
    },
    update: {},
    create: {
      membershipId: managerMembership.id,
      worksiteId: site.id,
    },
  });

  // 3. Seed Field Employee (User + Profile + Membership + Device)
  const employeeUser = await prisma.user.upsert({
    where: { email: 'john.doe@acme.com' },
    update: {
      passwordHash: employeePasswordHash,
      pinHash: employeePinHash,
    },
    create: {
      email: 'john.doe@acme.com',
      fullName: 'John Doe',
      passwordHash: employeePasswordHash,
      pinHash: employeePinHash,
      isActive: true,
    },
  });

  const employeeMembership = await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: employeeUser.id,
      },
    },
    update: { role: 'MEMBER' },
    create: {
      organizationId: org.id,
      userId: employeeUser.id,
      role: 'MEMBER',
    },
  });

  const employeeProfile = await prisma.employeeProfile.upsert({
    where: {
      organizationId_employeeCode: {
        organizationId: org.id,
        employeeCode: 'EMP-001',
      },
    },
    update: {
      userId: employeeUser.id,
      membershipId: employeeMembership.id,
      primaryWorksiteId: site.id,
    },
    create: {
      organizationId: org.id,
      userId: employeeUser.id,
      membershipId: employeeMembership.id,
      employeeCode: 'EMP-001',
      fullName: 'John Doe',
      department: 'Field Operations',
      primaryWorksiteId: site.id,
      isActive: true,
    },
  });

  const deviceSecret = 'dev-secret-1234567890';
  const deviceSecretHash = crypto.createHash('sha256').update(deviceSecret).digest('hex');

  await prisma.deviceBinding.upsert({
    where: {
      employeeProfileId_deviceId: {
        employeeProfileId: employeeProfile.id,
        deviceId: 'device-pixel-8',
      },
    },
    update: { deviceSecretHash },
    create: {
      employeeProfileId: employeeProfile.id,
      deviceId: 'device-pixel-8',
      deviceSecretHash,
      deviceModel: 'Google Pixel 8',
      osVersion: 'Android 14',
      isTrusted: true,
    },
  });

  console.log('✅ Phase 2 Seed completed successfully:', {
    org: org.name,
    owner: ownerUser.email,
    manager: managerUser.email,
    employee: employeeProfile.employeeCode,
  });
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
