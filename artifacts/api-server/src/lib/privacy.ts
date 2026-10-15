import { eq, lt } from "drizzle-orm";
import { db, enquiriesTable, privacySettingsTable } from "@workspace/db";

export async function getPrivacySettings() {
  await db
    .insert(privacySettingsTable)
    .values({ id: 1, enquiryRetentionDays: null })
    .onConflictDoNothing();

  const [settings] = await db
    .select()
    .from(privacySettingsTable)
    .where(eq(privacySettingsTable.id, 1))
    .limit(1);

  if (!settings) {
    throw new Error("Unable to load privacy settings");
  }

  return settings;
}

export async function purgeExpiredEnquiries(): Promise<number> {
  const settings = await getPrivacySettings();
  if (settings.enquiryRetentionDays === null) return 0;

  const cutoff = new Date(
    Date.now() - settings.enquiryRetentionDays * 24 * 60 * 60 * 1000,
  );
  const deleted = await db
    .delete(enquiriesTable)
    .where(lt(enquiriesTable.createdAt, cutoff))
    .returning({ id: enquiriesTable.id });

  return deleted.length;
}
