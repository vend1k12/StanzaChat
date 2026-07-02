import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>StanzaChat</h1>
      <p>Open-source, self-hosted AI workspace.</p>
      <nav style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
        <Link href="/auth/sign-in">Sign in</Link>
        <Link href="/auth/sign-up">Sign up</Link>
      </nav>
    </main>
  );
}
