import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/useAuth";
import type { User } from "../services/auth";
import { showToast } from "../lib/toast";

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return <div className="shell py-16 text-center text-charcoal/60">Loading profile…</div>;
  }

  return <ProfileForm key={user.id} user={user} />;
}

function ProfileForm({ user }: { user: User }) {
  const { updateProfile, changePassword } = useAuth();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [phone, setPhone] = useState(user.phone);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);


  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const form = new FormData();
      form.append("first_name", firstName.trim());
      form.append("last_name", lastName.trim());
      form.append("phone", phone.trim());
      form.append("bio", bio.trim());
      if (avatar) form.append("avatar", avatar);
      await updateProfile(form);
      setAvatar(null);
      setSaved(true);
      showToast("Profile updated.", "success", "ReWear");
    } catch {
      showToast("Couldn't update your profile.", "error", "Invalid action");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordSaved(false);
    try {
      if (newPassword !== confirmPassword) {
        showToast("New passwords don't match.", "error", "Invalid action");
        return;
      }
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      showToast("Password changed.", "success", "ReWear");
    } catch {
      showToast("Couldn't change your password.", "error", "Invalid action");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="shell py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-leaf-600">
          Account settings
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-leaf-700">Profile</h1>

        <div className="mt-6 rounded-3xl border border-leaf-300/40 bg-white p-6">
          <div className="flex items-center gap-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.display_name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-leaf-600 text-2xl font-bold text-cream">
                {user.display_name[0]?.toUpperCase() ?? "R"}
              </div>
            )}
            <div>
              <p className="font-semibold">{user.display_name}</p>
              <p className="text-sm text-charcoal/60">
                @{user.username ?? "username not set"} · {user.email}
              </p>
              <p className="text-xs text-charcoal/50">
                ⭐ {Number(user.rating_avg).toFixed(1)} from {user.rating_count}{" "}
                {user.rating_count === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>

          {saved && <p className="mt-4 text-sm text-leaf-700">Saved — your profile is up to date.</p>}

          <form onSubmit={submit} className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                First name
                <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Last name
                <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-medium">
              Phone
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0917 123 4567" />
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              Bio
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={4}
                maxLength={500}
                className="min-h-28 rounded-xl border border-leaf-300/50 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/30"
                placeholder="Thrift curator, vintage denim lover…"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              Avatar
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                className="block text-sm text-charcoal/80 file:mr-3 file:rounded-full file:border-0 file:bg-leaf-600 file:px-4 file:py-2 file:font-semibold file:text-cream file:transition hover:file:bg-leaf-700"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-leaf-300/30 pt-4">
              <p className="text-xs text-charcoal/55">
                Username and email are managed by ReWear and can’t be changed here. You can change
                your password below.
              </p>
              <div className="flex gap-2">
                <Link
                  to="/seller-dashboard"
                  className="rounded-full border border-leaf-300/60 px-5 py-2.5 text-sm font-semibold text-leaf-700 hover:bg-leaf-50"
                >
                  Seller dashboard
                </Link>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </div>
          </form>

          <section className="mt-8 rounded-3xl border border-leaf-300/40 bg-cream/60 p-5">
            <h2 className="font-semibold text-charcoal">Change password</h2>
            {passwordSaved && <p className="mt-2 text-sm text-leaf-700">Password changed.</p>}
            <form onSubmit={submitPassword} className="mt-4 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Current password
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  New password
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Confirm new password
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <div>
                <Button type="submit" disabled={passwordBusy}>
                  {passwordBusy ? "Changing…" : "Change password"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
