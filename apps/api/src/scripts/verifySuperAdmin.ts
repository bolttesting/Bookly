import { config } from 'dotenv';
import { prisma } from '../config/prisma.js';

config();

async function verifySuperAdmin() {
  try {
    const user = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' },
    });

    if (user) {
      console.log('✅ Super Admin found:');
      console.log(`   Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
    } else {
      console.log('❌ Super Admin not found');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySuperAdmin();

