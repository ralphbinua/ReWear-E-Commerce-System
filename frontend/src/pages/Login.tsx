import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/useAuth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/browse", { replace: true });
    } catch {
      setError("Wrong credentials, or the API isn't running.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell flex justify-center py-12 md:py-20">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-leaf-300/40 bg-white p-6 shadow-sm"
      >
        <h1 className="font-display text-2xl font-semibold text-leaf-700">Sign in</h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Welcome back to your ReWear profile.
        </p>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Email
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Password
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "Signing you in…" : "Sign in"}
        </Button>
        <p className="mt-4 text-center text-sm text-charcoal/70">
          New here?{" "}
          <Link to="/register" className="font-semibold text-leaf-700 underline">
            Create an account
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-charcoal/70">
          Are you an admin?{" "}
          <a
            href="/admin/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-leaf-700 underline"
          >
            Admin login
          </a>
        </p>
      </form>
    </div>
  );
}
