import { FeedScreen } from "./feed-screen";
export const dynamic = "force-dynamic";
export default async function Updates({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <FeedScreen kind="updates" params={await searchParams} />;
}
