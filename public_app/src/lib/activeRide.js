// Remembers the in-progress trip id locally so a reload/return to /ride resumes the live trip
// instead of dropping the rider back at the address-picker.
const KEY = "gabla_active_ride_trip";

export const getActiveTripId = () => {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
};

export const setActiveTripId = (tripId) => {
  try {
    localStorage.setItem(KEY, tripId);
  } catch {
    // Storage unavailable — trip just won't resume across a reload.
  }
};

export const clearActiveTripId = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
};
