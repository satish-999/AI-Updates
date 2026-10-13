import { Feed } from "../components/feed";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Feed kind="updates" params={await searchParams} />;
}
