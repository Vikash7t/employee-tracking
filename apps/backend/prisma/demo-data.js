/**
 * Phase 11 Synthetic Demonstration Fixtures.
 * Provides 20 realistic employee profiles, 3 diverse worksites (circular & polygon),
 * 3 shift schedules (day, evening, overnight), and representative attendance states.
 */

const WORKSITES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Bengaluru Central Office (HQ)',
    worksiteType: 'CIRCULAR',
    latitude: 12.9857016,
    longitude: 77.5979309,
    radiusMeters: 60,
    polygonCoordinates: null,
    gracePeriodSeconds: 120,
    isActive: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Whitefield Tech Park Campus',
    worksiteType: 'POLYGON',
    latitude: 12.9698,
    longitude: 77.7499,
    radiusMeters: 50,
    polygonCoordinates: [
      [
        [77.7485, 12.9685],
        [77.7515, 12.9685],
        [77.7520, 12.9715],
        [77.7480, 12.9715],
        [77.7485, 12.9685],
      ],
    ],
    gracePeriodSeconds: 180,
    isActive: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Electronic City Logistics Hub',
    worksiteType: 'CIRCULAR',
    latitude: 12.8399,
    longitude: 77.677,
    radiusMeters: 100,
    polygonCoordinates: null,
    gracePeriodSeconds: 300,
    isActive: true,
  },
];

const SHIFTS = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Morning General Shift',
    startTime: '09:00',
    endTime: '18:00',
    lateArrivalGraceMin: 15,
    earlyExitGraceMin: 10,
    breakAllowanceMin: 60,
    isOvernight: false,
    workDays: [1, 2, 3, 4, 5],
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Evening Operations Flex',
    startTime: '14:00',
    endTime: '22:00',
    lateArrivalGraceMin: 10,
    earlyExitGraceMin: 10,
    breakAllowanceMin: 45,
    isOvernight: false,
    workDays: [1, 2, 3, 4, 5, 6],
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    name: 'Night Logistics Shift',
    startTime: '22:00',
    endTime: '06:00',
    lateArrivalGraceMin: 15,
    earlyExitGraceMin: 15,
    breakAllowanceMin: 60,
    isOvernight: true,
    workDays: [1, 2, 3, 4, 5],
  },
];

const EMPLOYEES = [
  { code: 'EMP-001', name: 'John Doe', email: 'john.doe@acme.com', dept: 'Field Operations', role: 'MEMBER' },
  { code: 'EMP-002', name: 'Sarah Connor', email: 'sarah.c@acme.com', dept: 'Engineering', role: 'MEMBER' },
  { code: 'EMP-003', name: 'Marcus Wright', email: 'marcus.w@acme.com', dept: 'Engineering', role: 'MEMBER' },
  { code: 'EMP-004', name: 'Elena Rostova', email: 'elena.r@acme.com', dept: 'Engineering', role: 'MEMBER' },
  { code: 'EMP-005', name: 'David Kim', email: 'david.k@acme.com', dept: 'Logistics', role: 'MEMBER' },
  { code: 'EMP-006', name: 'Priya Sharma', email: 'priya.s@acme.com', dept: 'Logistics', role: 'MEMBER' },
  { code: 'EMP-007', name: 'Carlos Mendez', email: 'carlos.m@acme.com', dept: 'Logistics', role: 'MEMBER' },
  { code: 'EMP-008', name: 'Aisha Al-Mansoor', email: 'aisha.m@acme.com', dept: 'Field Operations', role: 'MEMBER' },
  { code: 'EMP-009', name: 'Liam O’Connor', email: 'liam.o@acme.com', dept: 'Field Operations', role: 'MEMBER' },
  { code: 'EMP-010', name: 'Kenji Takahashi', email: 'kenji.t@acme.com', dept: 'Field Operations', role: 'MEMBER' },
  { code: 'EMP-011', name: 'Fatima Zahra', email: 'fatima.z@acme.com', dept: 'Quality Assurance', role: 'MEMBER' },
  { code: 'EMP-012', name: 'Viktor Hansen', email: 'viktor.h@acme.com', dept: 'Quality Assurance', role: 'MEMBER' },
  { code: 'EMP-013', name: 'Mei Lin', email: 'mei.l@acme.com', dept: 'Quality Assurance', role: 'MEMBER' },
  { code: 'EMP-014', name: 'Amara Okafor', email: 'amara.o@acme.com', dept: 'Field Operations', role: 'MEMBER' },
  { code: 'EMP-015', name: 'Dmitri Volkov', email: 'dmitri.v@acme.com', dept: 'Logistics', role: 'MEMBER' },
  { code: 'EMP-016', name: 'Chloe Dubois', email: 'chloe.d@acme.com', dept: 'Engineering', role: 'MEMBER' },
  { code: 'EMP-017', name: 'Tariq Hassan', email: 'tariq.h@acme.com', dept: 'Engineering', role: 'MEMBER' },
  { code: 'EMP-018', name: 'Sunita Patel', email: 'sunita.p@acme.com', dept: 'Quality Assurance', role: 'MEMBER' },
  { code: 'EMP-019', name: 'Bob Manager', email: 'manager@acme.com', dept: 'Management', role: 'MANAGER' },
  { code: 'EMP-020', name: 'Alice Owner', email: 'owner@acme.com', dept: 'Executive', role: 'OWNER' },
];

module.exports = {
  WORKSITES,
  SHIFTS,
  EMPLOYEES,
};
