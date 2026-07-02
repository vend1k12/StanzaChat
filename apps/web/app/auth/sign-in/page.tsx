import Link from "next/link";

export const metadata = { title: "Sign in — StanzaChat" };

export default function SignInPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 400, margin: "0 auto" }}>
      <h1>Sign in</h1>
      <form
        action="/api/auth/sign-in/email"
        method="POST"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <p style={{ marginTop: "1.5rem" }}>
        No account? <Link href="/auth/sign-up">Sign up</Link>
      </p>
    </main>
  );
}
