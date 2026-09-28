import QuizRunner from "@/components/QuizRunner";
import { requireUser } from "@/lib/auth";
export const metadata = { title: "Quiz · LearnFlow AI" };
export default async function QuizPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const key = (["surprise", "concept", "material", "revision"] as const).find((k) => sp[k]);
  const query = key ? `${key}=${encodeURIComponent(sp[key]!)}` : "revision=quick";
  const back = sp.concept ? `/learn/${sp.concept}` : sp.material ? `/materials/${sp.material}` : sp.revision ? "/revision" : "/dashboard";
  return <QuizRunner key={query} query={query} language={user.primaryLanguage} preferred={[user.primaryLanguage, user.secondaryLanguage, "en"]} surpriseId={sp.surprise} backHref={back} />;
}
