import { db } from "@/db";
import { materialFiles, materials } from "@/db/schema";
import { apiUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { startProcessing } from "@/lib/pipeline";
import { SAMPLE_FILE_NAME, SAMPLE_MODEL } from "@/lib/sample";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = ["pdf", "epub", "docx", "ppt", "pptx", "jpg", "jpeg", "png", "txt", "md"];

export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { sample?: boolean };
    if (!body.sample) return Response.json({ error: "Nothing to upload." }, { status: 400 });
    const [m] = await db.insert(materials).values({
      userId: user.id, title: SAMPLE_MODEL.title, subject: SAMPLE_MODEL.subject, fileName: SAMPLE_FILE_NAME,
      mimeType: "application/pdf", fileSize: 0, status: "queued",
    }).returning();
    startProcessing(m.id, user.id, "sample");
    return Response.json({ id: m.id });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: "Upload failed. Please try again." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Please choose a file." }, { status: 400 });
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED.includes(ext)) return Response.json({ error: "Supported: PDF, EPUB, DOCX, PPT/PPTX, JPG, PNG." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Files up to 15 MB are supported on the free plan." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "That file looks empty." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const title = (form.get("title") as string | null)?.trim() || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  const subject = (form.get("subject") as string | null)?.trim() || user.subject || null;
  const [m] = await db.insert(materials).values({
    userId: user.id, title, subject, fileName: file.name, mimeType: file.type, fileSize: file.size, status: "queued",
  }).returning();
  await db.insert(materialFiles).values({ materialId: m.id, dataBase64: buf.toString("base64") });
  startProcessing(m.id, user.id, "file");
  return Response.json({ id: m.id });
}
