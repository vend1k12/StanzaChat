import Link from "next/link";

export const metadata = { title: "Sign up — StanzaChat" };

export default function SignUpPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 400, margin: "0 auto" }}>
      <h1>Sign up</h1>
      <form
        action="/api/auth/sign-up/email"
        method="POST"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        <label>
          Name
          <input
            name="name"
            type="text"
            required
            style={{ display: "block", width: "100%" }}
          />
        </label>
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
            minLength={8}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <button type="submit">Sign up</button>
      </form>
      <p style={{ marginTop: "1.5rem" }}>
        Already have an account? <Link href="/auth/sign-in">Sign in</Link>
      </p>
    </main>
  );
}
