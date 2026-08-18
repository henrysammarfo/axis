// Lightweight, client-only profile store: display name + avatar choice.
// Persisted in localStorage per user (a UI preference, not on-chain state), so
// it needs no backend changes and survives refreshes on the same device.

export type AxisAvatar = {
  id: string;
  src: string;
  label: string;
};

// Geometric AXIS marks (inline SVG in AxisAvatar) — photo files were never shipped.
export const AXIS_AVATARS: AxisAvatar[] = [
  { id: "axis-01", src: "axis-01", label: "Studio" },
  { id: "axis-02", src: "axis-02", label: "Neon" },
  { id: "axis-03", src: "axis-03", label: "Profile" },
  { id: "axis-04", src: "axis-04", label: "Hooded" },
  { id: "axis-05", src: "axis-05", label: "Soft" },
  { id: "axis-06", src: "axis-06", label: "Lime" },
];

export const DEFAULT_AVATAR_ID = AXIS_AVATARS[0].id;

export type Profile = {
  // Either an avatar id from AXIS_AVATARS, or an uploaded image data URL.
  avatar: string;
  // Optional friendly display name; falls back to the email handle.
  name?: string;
};

const PROFILE_EVENT = "axis:profile-changed";

function storageKey(userId: string): string {
  return `axis:profile:${userId}`;
}

/** Turn an email into a friendly default name ("ada.lovelace" → "Ada Lovelace"). */
export function nameFromEmail(email?: string | null): string {
  if (!email) return "AXIS user";
  const handle = email.split("@")[0] ?? "";
  const cleaned = handle.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "AXIS user";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Resolve a stored avatar value to an <img src>. Data URLs pass through. */
export function resolveAvatarSrc(avatar: string | undefined): string {
  if (!avatar) return AXIS_AVATARS[0].src;
  if (avatar.startsWith("data:") || avatar.startsWith("http") || avatar.startsWith("/")) {
    return avatar;
  }
  const match = AXIS_AVATARS.find((a) => a.id === avatar);
  return match?.src ?? AXIS_AVATARS[0].src;
}

export function getProfile(userId: string): Profile {
  const fallback: Profile = { avatar: DEFAULT_AVATAR_ID };
  if (typeof window === "undefined" || !userId) return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      avatar: parsed.avatar || DEFAULT_AVATAR_ID,
      name: parsed.name?.trim() || undefined,
    };
  } catch {
    return fallback;
  }
}

/**
 * Merge server-owned profile values into the local cache. The backend is the
 * source of truth (so a profile follows the user across devices); the local
 * cache just gives an instant first paint. Only overwrites when the server has
 * a non-empty value and it differs, and fires the change event so live views
 * update.
 */
export function hydrateProfileFromServer(
  userId: string,
  data: { display_name?: string | null; avatar?: string | null },
): void {
  if (typeof window === "undefined" || !userId) return;
  const current = getProfile(userId);
  const next: Profile = { ...current };
  let changed = false;
  if (data.avatar && data.avatar !== current.avatar) {
    next.avatar = data.avatar;
    changed = true;
  }
  if (data.display_name && data.display_name !== current.name) {
    next.name = data.display_name;
    changed = true;
  }
  if (changed) saveProfile(userId, next);
}

export function saveProfile(userId: string, profile: Profile): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: { userId } }));
  } catch {
    /* storage full or unavailable — non-fatal for a UI preference */
  }
}

export function subscribeProfile(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(PROFILE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(PROFILE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * Read an uploaded image file and downscale it to a small square data URL so it
 * fits comfortably in localStorage and renders crisply at avatar sizes.
 */
export function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image couldn't be loaded."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing isn't supported here."));
          return;
        }
        // Cover-fit: crop to a centered square, then scale down.
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
