import { request } from "./api";
import { getSession, setSession } from "./session";

// The district a shopper chose (welcome form or location picker). Used to arrange products around
// them when they haven't shared their exact position. Kept on the device for everyone and also on
// the account for signed-in users, so it follows them to other devices.
const KEY = "gabla_preferred_district";

export const getPreferredDistrict = () => {
  try {
    return localStorage.getItem(KEY) || getSession()?.user?.profile?.district || null;
  } catch {
    return getSession()?.user?.profile?.district || null;
  }
};

export const savePreferredDistrict = async (district, { sync = true } = {}) => {
  try {
    if (district) localStorage.setItem(KEY, district);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the choice just won't outlive this tab.
  }
  const session = getSession();
  if (!sync || !session?.accessToken) return;
  try {
    const { user } = await request("/auth/me", { method: "PATCH", body: JSON.stringify({ profile: { district: district || null } }) });
    setSession({ ...session, user: { ...session.user, ...user } });
  } catch {
    // The device copy above is already saved; syncing to the account can wait for next time.
  }
};
