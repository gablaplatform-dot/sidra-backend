// "Sign in, then bring me back": every sign-in entry point links to /login?next=<where the user is>
// and Login sends them there afterwards, instead of always dropping them on /home.

// Only same-site paths are allowed, so a crafted ?next= can never bounce someone to another origin
// (open redirect), and /login itself is excluded to avoid a redirect loop.
export const safeNext = (raw) => {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw === "/login" || raw.startsWith("/login?") || raw.startsWith("/login/")) return null;
  return raw;
};

// `resume` names an action to pick back up on arrival (e.g. "buy" reopens the buy dialog).
export const loginPath = (location, { resume } = {}) => {
  const params = new URLSearchParams(location.search);
  if (resume) params.set("resume", resume);
  else params.delete("resume");
  const query = params.toString();
  const target = `${location.pathname}${query ? `?${query}` : ""}${location.hash || ""}`;
  return safeNext(target) ? `/login?next=${encodeURIComponent(target)}` : "/login";
};
