import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Upload, Settings } from "lucide-react";
import { Route as AuthenticatedRoute } from "../_authenticated";
import { brandHeadMeta } from "../../lib/seo";
import { useProfile } from "../../hooks/useProfile";
import { useUpdateProfile } from "../../hooks/useAxis";
import {
  AXIS_AVATARS,
  fileToAvatarDataUrl,
  getProfile,
  nameFromEmail,
  resolveAvatarSrc,
  saveProfile,
} from "../../lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () =>
    brandHeadMeta({
      title: "Profile — AXIS",
      description: "Set your name and pick an AXIS avatar.",
      path: "/profile",
      noIndex: true,
    }),
  component: ProfilePage,
});

function ProfilePage() {
  const { session } = AuthenticatedRoute.useRouteContext();
  const navigate = useNavigate();
  const userId = session.userId;
  const stored = getProfile(userId);
  const serverProfile = useProfile(userId);
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState(stored.name ?? nameFromEmail(session.email));
  const [avatar, setAvatar] = useState(stored.avatar);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const touched = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed the form from the synced profile (server → local) until the user edits.
  useEffect(() => {
    if (touched.current) return;
    setName(serverProfile.name ?? nameFromEmail(session.email));
    setAvatar(serverProfile.avatar);
  }, [serverProfile.name, serverProfile.avatar, session.email]);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      touched.current = true;
      setAvatar(dataUrl);
    } catch (e) {
      toast.error("Couldn't use that image", {
        description: e instanceof Error ? e.message : "Try a different photo.",
      });
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    const trimmed = name.trim();
    setSaving(true);
    // Local cache first for instant paint; then persist to the backend so it
    // follows the user across devices.
    saveProfile(userId, { name: trimmed || undefined, avatar });
    try {
      await updateProfile.mutateAsync({
        user_id: userId,
        ua_address: session.uaAddress,
        display_name: trimmed || null,
        avatar,
      });
      toast.success("Profile saved", { description: "Synced to your account." });
      navigate({ to: "/dashboard", search: { tab: "overview", chain: "All" } });
    } catch (e) {
      toast.error("Saved on this device", {
        description:
          e instanceof Error ? `Couldn't sync yet: ${e.message}` : "Couldn't sync to your account.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-tight">
      <header className="border-b border-white/10">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/dashboard"
            search={{ tab: "overview", chain: "All" }}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.75} /> Back
          </Link>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <Settings size={16} strokeWidth={1.75} /> Settings
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-6 py-10 space-y-10">
        <div>
          <h1 className="text-3xl sm:text-4xl tracking-[-0.03em]">Your profile</h1>
          <p className="mt-2 text-white/55 text-[15px] leading-relaxed">
            A calm little corner that's yours. Pick a name and an AXIS avatar — this is just for
            you, it stays on this device.
          </p>
        </div>

        {/* Identity preview */}
        <section className="card-calm p-6 flex items-center gap-5">
          <img
            src={resolveAvatarSrc(avatar)}
            alt="Your avatar"
            className="h-20 w-20 rounded-full object-cover border border-white/10 bg-white/5 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xl tracking-[-0.02em] truncate">{name.trim() || "AXIS user"}</p>
            <p className="text-sm text-white/45 truncate">
              {session.email ?? "Signed in with Google"}
            </p>
          </div>
        </section>

        {/* Name */}
        <section className="space-y-3">
          <label htmlFor="displayName" className="block text-sm text-white/70">
            Display name
          </label>
          <input
            id="displayName"
            value={name}
            onChange={(e) => {
              touched.current = true;
              setName(e.target.value);
            }}
            maxLength={40}
            placeholder="What should we call you?"
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-white/30 transition-colors"
          />
        </section>

        {/* Avatar picker */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg tracking-[-0.02em]">Choose an avatar</h2>
            <p className="text-sm text-white/45 mt-1">
              Six AXIS marks — quiet, geometric, on brand.
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {AXIS_AVATARS.map((a) => {
              const selected = avatar === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    touched.current = true;
                    setAvatar(a.id);
                  }}
                  aria-pressed={selected}
                  title={a.label}
                  className={`relative aspect-square rounded-2xl overflow-hidden border transition-all ${
                    selected
                      ? "border-[color:var(--color-lime)] ring-2 ring-[color:var(--color-lime)]/40"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img src={a.src} alt={a.label} className="h-full w-full object-cover" />
                  {selected && (
                    <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-[color:var(--color-lime)] text-black grid place-items-center">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Upload */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg tracking-[-0.02em]">Or upload your own</h2>
            <p className="text-sm text-white/45 mt-1">
              We crop it to a neat square and keep it on your device.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 border border-white/15 hover:bg-white/5 rounded-full px-5 py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            <Upload size={15} strokeWidth={1.75} />
            {uploading ? "Working…" : "Upload a photo"}
          </button>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-[color:var(--color-lime)] text-black rounded-full px-7 py-3 text-sm font-medium hover:brightness-95 transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          <Link
            to="/dashboard"
            search={{ tab: "overview", chain: "All" }}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            Cancel
          </Link>
        </div>
      </main>
    </div>
  );
}
