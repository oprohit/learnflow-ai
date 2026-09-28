import UploadFlow from "@/components/UploadFlow";
import { requireUser } from "@/lib/auth";
export const metadata = { title: "Upload · LearnFlow AI" };
export default async function Page({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  return <UploadFlow subject={user.subject} welcome={welcome === "1"} />;
}
