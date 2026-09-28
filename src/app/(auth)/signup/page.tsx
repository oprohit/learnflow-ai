import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getUser } from "@/lib/auth";
export const metadata = { title: "Create account · LearnFlow AI" };
export default async function Page() {
  const u = await getUser();
  if (u) redirect(u.onboarded ? "/dashboard" : "/onboarding");
  return <AuthForm kind="signup" />;
}
