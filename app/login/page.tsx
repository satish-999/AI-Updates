export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const message =
    error === "unconfigured"
      ? "AUTH_SECRET is not set on the server. The app stays locked until it is."
      : error
        ? "Wrong password."
        : null;

  return (
    <div className="login">
      <h1>AI Pulse</h1>
      <p>Private. One user.</p>
      <form method="POST" action="/api/login">
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          aria-label="Password"
        />
        <button type="submit">Sign in</button>
      </form>
      {message && <p className="err">{message}</p>}
    </div>
  );
}
