import { redirect } from "next/navigation";
import Onboarding from "@/components/Onboarding";
import { requireUser } from "@/lib/auth";
export const metadata = { title: "Welcome · LearnFlow AI" };
export default async function Page() {
  const u = await requireUser();
  if (u.onboarded) redirect("/dashboard");
  return <Onboarding name={u.name} />;
}
