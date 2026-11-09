const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding initial organization and worksites...');

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

  console.log('✅ Seed completed:', { org: org.name, site: site.name });
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
