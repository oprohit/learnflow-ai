import AuthForm from "@/components/AuthForm";
export const metadata = { title: "New password · LearnFlow AI" };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthForm kind="reset" token={token ?? ""} />;
}
