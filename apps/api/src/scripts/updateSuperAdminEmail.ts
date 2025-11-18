import { config } from 'dotenv';
import { prisma } from '../config/prisma.js';

// Load environment variables
config();

const NEW_EMAIL = 'ahmadhasnain6145@gmail.com';

async function updateSuperAdminEmail() {
  try {
    console.log('🔄 Updating super admin email...');

    // Find the super admin user
    const superAdmin = await prisma.user.findFirst({
      where: {
        role: 'SUPERADMIN',
      },
    });

    if (!superAdmin) {
      console.error('❌ Super admin user not found. Please create one first using: npm run seed:superadmin');
      process.exit(1);
    }

    // Check if the new email is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { email: NEW_EMAIL },
    });

    if (existingUser && existingUser.id !== superAdmin.id) {
      console.error(`❌ Email ${NEW_EMAIL} is already taken by another user.`);
      process.exit(1);
    }

    // Update the email using raw SQL to bypass Prisma type checking
    // Try to update with emailVerified if column exists, otherwise just update email
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET email = $1, "emailVerified" = true WHERE id = $2`,
        NEW_EMAIL,
        superAdmin.id,
      );
    } catch (error: any) {
      // If emailVerified column doesn't exist, just update email
      if (error.message?.includes('emailVerified')) {
        await prisma.$executeRawUnsafe(
          `UPDATE "User" SET email = $1 WHERE id = $2`,
          NEW_EMAIL,
          superAdmin.id,
        );
      } else {
        throw error;
      }
    }

    console.log('✅ Super admin email updated successfully!');
    console.log(`📧 New email: ${NEW_EMAIL}`);
    console.log(`🆔 User ID: ${superAdmin.id}`);
    console.log('\n✅ Password reset will work for this email address.');
  } catch (error) {
    console.error('❌ Error updating super admin email:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateSuperAdminEmail();

