import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications)
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return <AppShell name={user.name} unread={n}>{children}</AppShell>;
}
