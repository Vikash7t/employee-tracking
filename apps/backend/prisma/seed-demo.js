/**
 * Phase 11 Synthetic Demonstration Environment Seeder.
 * Idempotently populates 20 employees, 3 worksites, 3 shifts, and realistic attendance states.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const { WORKSITES, SHIFTS, EMPLOYEES } = require('./demo-data');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const prisma = new PrismaClient();

async function main() {
  console.log('🌟 [Seed-Demo] Initializing Phase 11 Synthetic Enterprise Environment...');

  // 1. Organization Setup
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: { name: 'Acme Operations Ltd (Global Demo)' },
    create: {
      name: 'Acme Operations Ltd (Global Demo)',
      slug: 'acme-corp',
      timezone: 'Asia/Kolkata',
      isActive: true,
    },
  });

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('DemoPass123!', saltRounds);
  const pinHash = await bcrypt.hash('1234', saltRounds);

  // 2. Worksites Seeding (Circular HQ, Polygon Campus, Logistics Hub)
  const seededSites = [];
  for (const site of WORKSITES) {
    const s = await prisma.worksite.upsert({
      where: { id: site.id },
      update: {
        name: site.name,
        worksiteType: site.worksiteType,
        latitude: site.latitude,
        longitude: site.longitude,
        radiusMeters: site.radiusMeters,
        polygonCoordinates: site.polygonCoordinates,
        gracePeriodSeconds: site.gracePeriodSeconds,
      },
      create: {
        id: site.id,
        organization: { connect: { id: org.id } },
        name: site.name,
        worksiteType: site.worksiteType,
        latitude: site.latitude,
        longitude: site.longitude,
        radiusMeters: site.radiusMeters,
        polygonCoordinates: site.polygonCoordinates,
        gracePeriodSeconds: site.gracePeriodSeconds,
        isActive: true,
      },
    });
    seededSites.push(s);
  }

  // 3. Shifts Seeding (Day, Flex, Overnight)
  const seededShifts = [];
  for (const shift of SHIFTS) {
    const sh = await prisma.shiftTemplate.upsert({
      where: { id: shift.id },
      update: {
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        lateArrivalGraceMin: shift.lateArrivalGraceMin,
        earlyExitGraceMin: shift.earlyExitGraceMin,
        breakAllowanceMin: shift.breakAllowanceMin,
        isOvernight: shift.isOvernight,
      },
      create: {
        id: shift.id,
        organization: { connect: { id: org.id } },
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        lateArrivalGraceMin: shift.lateArrivalGraceMin,
        earlyExitGraceMin: shift.earlyExitGraceMin,
        breakAllowanceMin: shift.breakAllowanceMin,
        isOvernight: shift.isOvernight,
      },
    });
    seededShifts.push(sh);
  }

  // 4. Employees & Users Seeding (20 Fictional Profiles)
  const seededProfiles = [];
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const emp = EMPLOYEES[i];
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: { fullName: emp.name, passwordHash, pinHash },
      create: {
        email: emp.email,
        fullName: emp.name,
        passwordHash,
        pinHash,
        isActive: true,
      },
    });

    const membership = await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: { role: emp.role },
      create: {
        organization: { connect: { id: org.id } },
        user: { connect: { id: user.id } },
        role: emp.role,
      },
    });

    const profile = await prisma.employeeProfile.upsert({
      where: { organizationId_employeeCode: { organizationId: org.id, employeeCode: emp.code } },
      update: { fullName: emp.name, department: emp.dept, isActive: true },
      create: {
        organization: { connect: { id: org.id } },
        user: { connect: { id: user.id } },
        membership: { connect: { id: membership.id } },
        employeeCode: emp.code,
        fullName: emp.name,
        department: emp.dept,
        isActive: true,
      },
    });
    seededProfiles.push(profile);

    // Assign shifts cyclically
    const targetShift = seededShifts[i % seededShifts.length];
    const shiftDef = SHIFTS[i % SHIFTS.length];
    const existingAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        employeeProfileId: profile.id,
        shiftTemplateId: targetShift.id,
      },
    });

    if (!existingAssignment) {
      await prisma.shiftAssignment.create({
        data: {
          organization: { connect: { id: org.id } },
          employeeProfile: { connect: { id: profile.id } },
          shiftTemplate: { connect: { id: targetShift.id } },
          workDays: shiftDef.workDays || [1, 2, 3, 4, 5],
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        },
      });
    }
  }

  // 5. Representative Attendance Scenarios
  console.log('⏱️  Seeding representative attendance states (On-time, Late, Grace Period, Corrected)...');
  const primarySite = seededSites[0];
  const techSite = seededSites[1];
  const dayShift = seededShifts[0];
  const ownerUser = await prisma.user.findUnique({ where: { email: 'owner@acme.com' } });

  // Scenario A: Clean completed session (EMP-001)
  await prisma.attendanceSession.upsert({
    where: { id: '00000000-0000-0000-0000-000000000021' },
    update: {
      status: 'COMPLETED',
      reviewStatus: 'APPROVED',
      isLate: false,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000021',
      organization: { connect: { id: org.id } },
      employeeProfile: { connect: { id: seededProfiles[0].id } },
      worksite: { connect: { id: primarySite.id } },
      shiftTemplate: { connect: { id: dayShift.id } },
      clockInAt: new Date('2026-11-10T09:02:00Z'),
      clockOutAt: new Date('2026-11-10T18:05:00Z'),
      status: 'COMPLETED',
      reviewStatus: 'APPROVED',
      isLate: false,
      isEarlyDeparture: false,
      insideDurationSeconds: 31200,
      outsideDurationSeconds: 1380,
    },
  });

  // Scenario B: Late arrival with audited manual correction (EMP-002)
  await prisma.attendanceSession.upsert({
    where: { id: '00000000-0000-0000-0000-000000000022' },
    update: {
      status: 'COMPLETED',
      reviewStatus: 'APPROVED',
      isLate: true,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000022',
      organization: { connect: { id: org.id } },
      employeeProfile: { connect: { id: seededProfiles[1].id } },
      worksite: { connect: { id: techSite.id } },
      shiftTemplate: { connect: { id: dayShift.id } },
      clockInAt: new Date('2026-11-10T09:35:00Z'),
      clockOutAt: new Date('2026-11-10T18:00:00Z'),
      status: 'COMPLETED',
      reviewStatus: 'APPROVED',
      isLate: true,
      isEarlyDeparture: false,
      insideDurationSeconds: 29100,
      outsideDurationSeconds: 1200,
    },
  });

  if (ownerUser) {
    await prisma.attendanceCorrection.upsert({
      where: { id: '00000000-0000-0000-0000-000000000031' },
      update: {
        reason: 'Transit delay verified on central highway; grace lateness approved by manager.',
      },
      create: {
        id: '00000000-0000-0000-0000-000000000031',
        organization: { connect: { id: org.id } },
        attendanceSession: { connect: { id: '00000000-0000-0000-0000-000000000022' } },
        adjustedByUser: { connect: { id: ownerUser.id } },
        fieldAdjusted: 'reviewStatus',
        originalValue: 'PENDING_REVIEW',
        correctedValue: 'APPROVED',
        reason: 'Transit delay verified on central highway; grace lateness approved by manager.',
      },
    });
  }

  // Scenario C: Active session with pending exit grace period (EMP-003)
  await prisma.attendanceSession.upsert({
    where: { id: '00000000-0000-0000-0000-000000000023' },
    update: {
      status: 'ACTIVE',
      presenceStatus: 'EXIT_PENDING',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000023',
      organization: { connect: { id: org.id } },
      employeeProfile: { connect: { id: seededProfiles[2].id } },
      worksite: { connect: { id: primarySite.id } },
      shiftTemplate: { connect: { id: dayShift.id } },
      clockInAt: new Date(Date.now() - 3600000), // Clocked in 1 hr ago
      status: 'ACTIVE',
      presenceStatus: 'EXIT_PENDING',
      exitPendingSince: new Date(Date.now() - 30000), // Left boundary 30s ago
      exitGraceExpiresAt: new Date(Date.now() + 90000), // Grace period expires in 90s
      insideDurationSeconds: 3570,
      outsideDurationSeconds: 30,
    },
  });

  console.log('\n================================================================');
  console.log('🎉 PHASE 11 DEMONSTRATION ENVIRONMENT POPULATED SUCCESSFULLY');
  console.log('================================================================');
  console.log(`🏢 Organization:   ${org.name} (slug: ${org.slug})`);
  console.log(`📍 Worksites:      ${seededSites.length} (Circular HQ, Polygon Tech Campus, Logistics Hub)`);
  console.log(`⏰ Shift Models:   ${seededShifts.length} (Morning, Evening Flex, Overnight 22:00-06:00)`);
  console.log(`👥 Total Staff:    ${seededProfiles.length} Fictional Employees (Pass: "DemoPass123!", PIN: "1234")`);
  console.log('📊 Active States:   Completed On-Time, Audited Late Lateness, Exit Grace Period');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Demo seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
