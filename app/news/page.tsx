import { FeedScreen } from "../feed-screen";
export const dynamic = "force-dynamic";
export default async function News({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <FeedScreen kind="news" params={await searchParams} />;
}
