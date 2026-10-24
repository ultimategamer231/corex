import { date } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import type { SchoolDb } from "@/lib/supabase";

/** Published announcements for the member's roles (row-level security filters them). */
export async function AnnouncementList({ db, limit = 25 }: { db: SchoolDb; limit?: number }) {
  const settings = await getSettings();
  const items = rows(
    await db
      .from("announcements")
      .select("id, title, body, published_at")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(limit),
  );
  if (items.length === 0) return <p className="text-muted">No announcements yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => (
        <li key={a.id} className="rounded-xl border border-border bg-background p-5">
          <h3 className="text-lg font-bold">{a.title}</h3>
          <p className="text-sm text-muted">{date(a.published_at, settings.timezone)}</p>
          <p className="mt-2 whitespace-pre-line text-ink-soft">{a.body}</p>
        </li>
      ))}
    </ul>
  );
}
