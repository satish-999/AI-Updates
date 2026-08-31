import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="state">
        <h2>Not found</h2>
        <p>That story, entity or page does not exist.</p>
        <Link href="/">Back to the Pulse</Link>
      </div>
    </div>
  );
}
