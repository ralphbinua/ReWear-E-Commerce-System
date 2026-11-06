import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/useAuth";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
      navigate("/browse", { replace: true });
    } catch (err: unknown) {
      const response = (err as { response?: { data?: Record<string, unknown> } })
        ?.response?.data;
      const first = response ? Object.values(response).flat()[0] : undefined;
      setError(Array.isArray(first) ? first[0] : "Could not create the account.");
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
        <h1 className="font-display text-2xl font-semibold text-leaf-700">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-charcoal/70">
          Free forever. Buy, sell, trade, donate, auction.
        </p>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              First name
              <Input
                required
                value={form.first_name}
                onChange={update("first_name")}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Last name
              <Input
                required
                value={form.last_name}
                onChange={update("last_name")}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Username
            <Input
              required
              autoComplete="username"
              value={form.username}
              onChange={update("username")}
              placeholder="your_username"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Email
            <Input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              placeholder="you@example.com"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Password
            <Input
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={update("password")}
              placeholder="At least 8 characters"
            />
          </label>
        </div>

        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "Creating your closet…" : "Join ReWear"}
        </Button>
        <p className="mt-4 text-center text-sm text-charcoal/70">
          Already have an account?{" "}
          <Link to="/rewear/login" className="font-semibold text-leaf-700 underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
