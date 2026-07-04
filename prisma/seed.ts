import { prisma } from "./prisma";

// ----------------------------------------------------------------------
//  CONFIGURATION: Define System Schema here
// ----------------------------------------------------------------------

const FEATURES = [
  { name: "user_management", description: "Manage system users" },
  { name: "RBAC_management", description: "Manage roles and permissions" },
  { name: "material_management", description: "Manage material" },
  { name: "quiz_management", description: "Manage quizzes" },
] as const;

const ROLES = [
  { name: "SuperAdmin", description: "Full System Access" },
  { name: "Dosen", description: "Lecturer" },
  { name: "Mahasiswa", description: "Student" },
] as const;

// Helper Type for IntelliSense
type FeatureName = (typeof FEATURES)[number]["name"];

// Define Permissions: Who can do what?
// 1 = Create, 2 = Read, 3 = Update, 4 = Delete, 5 = Print
// We use a simplified config object:
const ROLE_PERMISSIONS: Record<
  string,
  Partial<
    Record<
      FeatureName,
      { c?: boolean; r?: boolean; u?: boolean; d?: boolean; p?: boolean }
    >
  >
> = {
  SuperAdmin: {
    user_management: { c: true, r: true, u: true, d: true, p: true },
    RBAC_management: { c: true, r: true, u: true, d: true, p: true },
    material_management: { c: true, r: true, u: true, d: true, p: true },
    quiz_management: { c: true, r: true, u: true, d: true, p: true },
  },
  Dosen: {
    user_management: { c: true, r: true, u: true, d: true, p: true },
    RBAC_management: { c: false, r: false, u: false, d: false, p: false },
    material_management: { c: true, r: true, u: true, d: true, p: true },
    quiz_management: { c: true, r: true, u: true, d: true, p: true },
  },
  Mahasiswa: {
    user_management: { c: false, r: false, u: false, d: false, p: false },
    RBAC_management: { c: false, r: false, u: false, d: false, p: false },
    material_management: { c: false, r: true, u: false, d: false, p: false },
    quiz_management: { c: true, r: true, u: true, d: true, p: true },
  },
};

// ----------------------------------------------------------------------
// 2. EXECUTION
// ----------------------------------------------------------------------

async function main() {
  console.log("🌱 Starting Database Seed...");

  // --- 1. Seed Features ---
  console.log("...seeding features");
  const featureMap = new Map<string, string>(); // Name -> ID

  for (const feat of FEATURES) {
    const created = await prisma.feature.upsert({
      where: { name: feat.name },
      update: {},
      create: feat,
    });
    featureMap.set(feat.name, created.id);
  }

  // --- 2. Seed Roles ---
  console.log("...seeding roles");
  const roleMap = new Map<string, string>(); // Name -> ID

  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    roleMap.set(role.name, created.id);
  }

  // --- 3. Seed Permissions (The Matrix) ---
  console.log("...seeding permissions (this might take a moment)");

  for (const [roleName, features] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) continue;

    for (const [featureName, perms] of Object.entries(features)) {
      const featureId = featureMap.get(featureName);
      if (!featureId) continue;

      await prisma.roleFeature.upsert({
        where: {
          roleId_featureId: { roleId, featureId },
        },
        update: {
          canCreate: perms.c ?? false,
          canRead: perms.r ?? false,
          canUpdate: perms.u ?? false,
          canDelete: perms.d ?? false,
          canPrint: perms.p ?? false,
        },
        create: {
          roleId,
          featureId,
          canCreate: perms.c ?? false,
          canRead: perms.r ?? false,
          canUpdate: perms.u ?? false,
          canDelete: perms.d ?? false,
          canPrint: perms.p ?? false,
        },
      });
    }
  }

  // --- 4. Seed Users ---
  console.log("...seeding users");
  const password = await Bun.password.hash("password123");

  // 1. SAFEGUARD: Get IDs first and throw error if missing
  console.log(roleMap);
  const adminRoleId = roleMap.get("SuperAdmin");
  const dosenRoleId = roleMap.get("Dosen");
  const mahasiswaRoleId = roleMap.get("Mahasiswa");

  if (!adminRoleId || !dosenRoleId || !mahasiswaRoleId) {
    throw new Error(
      "❌ CRITICAL ERROR: Role IDs missing. Did the Roles seeding step finish?",
    );
  }

  // Admin
  await prisma.user.upsert({
    where: { email: "admin@system.com" },
    update: { roleId: adminRoleId },
    create: {
      email: "admin@system.com",
      userId: "superAdmin",
      name: "Super Administrator",
      password,
      roleId: adminRoleId,
      isActive: true,
    },
  });

  // Dosen (1 user)
  await prisma.user.upsert({
    where: { email: "dosen1@system.com" },
    update: {
      roleId: dosenRoleId,
      name: "Dosen One",
    },
    create: {
      email: "dosen1@system.com",
      name: "Dosen One",
      password,
      userId: `${dosenRoleId}1`,
      roleId: dosenRoleId,
      isActive: true,
    },
  });
  console.log("Seeded user: dosen1@system.com");

  // Mahasiswa (1 user)
  await prisma.user.upsert({
    where: { email: "mahasiswa1@system.com" },
    update: {
      roleId: mahasiswaRoleId,
      name: "Mahasiswa One",
    },
    create: {
      email: "mahasiswa1@system.com",
      name: "Mahasiswa One",
      password,
      userId: `${mahasiswaRoleId}1`,
      roleId: mahasiswaRoleId,
      isActive: true,
    },
  });
  console.log("Seeded user: mahasiswa1@system.com");

  console.log("✅ Seeding completed successfully!");
  console.log("   - admin@system.com / Password123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
