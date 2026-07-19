import { useEffect, useState } from "react";
import {
  getProfile,
  hydrateProfileFromServer,
  subscribeProfile,
  type Profile,
} from "../lib/profile";
import { useAxisStatus } from "./useAxis";

/**
 * Reactive read of a user's profile. The backend (via /agent/status) is the
 * source of truth so the profile follows the user across devices; the local
 * cache gives an instant first paint and offline fallback. Re-renders when the
 * profile is saved locally, in another tab, or hydrated from the server.
 */
export function useProfile(userId: string | undefined): Profile {
  const [profile, setProfile] = useState<Profile>(() =>
    userId ? getProfile(userId) : { avatar: "axis-01" },
  );
  const { data: status } = useAxisStatus(userId);

  useEffect(() => {
    if (!userId) return;
    setProfile(getProfile(userId));
    return subscribeProfile(() => setProfile(getProfile(userId)));
  }, [userId]);

  useEffect(() => {
    if (!userId || !status) return;
    hydrateProfileFromServer(userId, {
      display_name: status.display_name,
      avatar: status.avatar,
    });
  }, [userId, status?.display_name, status?.avatar]);

  return profile;
}
