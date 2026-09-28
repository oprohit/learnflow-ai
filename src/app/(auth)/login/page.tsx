import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getUser } from "@/lib/auth";
export const metadata = { title: "Sign in · LearnFlow AI" };
export default async function Page() {
  const u = await getUser();
  if (u) redirect(u.onboarded ? "/dashboard" : "/onboarding");
  return <AuthForm kind="login" />;
}
