export {
  backupKey,
  backupKeyDate,
  backupSchema,
  backupStorageFromEnv,
  pruneBackups,
  type BackupResult,
  type BackupStorage,
} from "./backup.ts";
export { connect } from "./db.ts";
export { databaseUrl, isLocalDatabase, LOCAL_DATABASE_URL, LOCAL_PROJECT } from "./env.ts";
export { localSupabaseStatus, REPO_ROOT, type LocalSupabaseStatus } from "./local-supabase.ts";
export {
  DEFAULT_MIGRATIONS_ROOT,
  loadMigrations,
  migrateSchema,
  MigrationError,
  renderMigration,
  type MigrateResult,
  type Migration,
} from "./migrations.ts";
export {
  ADMIN_ROLES,
  FIRST_ADMIN_ROLE,
  MIGRATION_TARGETS,
  PRODUCTS,
  type MigrationTarget,
  type Product,
} from "./products.ts";
export {
  addToRegistry,
  readRegistry,
  registryPath,
  schemasFor,
  type RegistryEntry,
} from "./registry.ts";
export { assertSchemaName, SchemaNameError } from "./schema-name.ts";
export {
  supabaseAdmin,
  supabaseAdminConfig,
  type AdminClient,
  type SupabaseAdminConfig,
} from "./supabase-admin.ts";
export {
  FIXTURE_PASSWORD,
  fixtureEmail,
  SCHOOL_ROLES,
  type SchoolFixture,
  type SchoolRole,
  seedSchoolFixture,
} from "./fixtures/school.ts";
