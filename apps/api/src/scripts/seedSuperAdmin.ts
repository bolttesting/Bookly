import { config } from 'dotenv';
import { prisma } from '../config/prisma.js';
import { hashPassword } from '../utils/password.js';

// Load environment variables
config();

const SUPERADMIN_EMAIL = 'admin@bookly.com';
const SUPERADMIN_PASSWORD = 'Admin123!@#';

async function seedSuperAdmin() {
  try {
    console.log('🌱 Seeding super admin user...');

    // Ensure SUPERADMIN enum value exists in database
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'SUPERADMIN' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
          ) THEN
            ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';
          END IF;
        END $$;
      `);
      console.log('✅ SUPERADMIN enum value ensured');
    } catch (error: any) {
      // Ignore if enum value already exists or other non-critical errors
      if (!error.message?.includes('already exists')) {
        console.warn('⚠️  Could not ensure enum value (might already exist):', error.message);
      }
    }

    // Regenerate Prisma client to pick up the new enum value
    // (In production, you'd run: npm run prisma:generate)

    // Check if super admin already exists
    const existing = await prisma.user.findUnique({
      where: { email: SUPERADMIN_EMAIL },
    });

    if (existing) {
      console.log('✅ Super admin already exists:', SUPERADMIN_EMAIL);
      console.log('📧 Email:', SUPERADMIN_EMAIL);
      console.log('🔑 Password:', SUPERADMIN_PASSWORD);
      return;
    }

    // Create super admin user using raw SQL to bypass Prisma validation
    const passwordHash = await hashPassword(SUPERADMIN_PASSWORD);

    const result = await prisma.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, "passwordHash", "firstName", "lastName", role, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        $1,
        $2,
        $3,
        $4,
        'SUPERADMIN'::"UserRole",
        NOW(),
        NOW()
      )
      RETURNING id, email, "firstName", "lastName", role;
    `, SUPERADMIN_EMAIL, passwordHash, 'Super', 'Admin');

    const superAdmin = Array.isArray(result) && result.length > 0 ? result[0] : { id: 'unknown' };

    console.log('✅ Super admin created successfully!');
    console.log('📧 Email:', SUPERADMIN_EMAIL);
    console.log('🔑 Password:', SUPERADMIN_PASSWORD);
    console.log('🆔 User ID:', superAdmin.id);
  } catch (error) {
    console.error('❌ Error seeding super admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedSuperAdmin();

