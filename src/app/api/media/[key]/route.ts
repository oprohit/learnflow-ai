import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaCache } from "@/db/schema";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { key } = await ctx.params;
  const [m] = await db.select().from(mediaCache).where(eq(mediaCache.key, decodeURIComponent(key)));
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m.dataBase64, "base64"), {
    headers: { "content-type": m.mime, "cache-control": "private, max-age=31536000, immutable" },
  });
}
