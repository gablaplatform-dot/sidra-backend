import { useEffect, useState } from "react";

import { getEnabledModules } from "./api";

// Default to everything on so nothing is hidden before the fetch resolves (or if it fails) -
// a missed admin toggle staying visible for a moment is harmless; wrongly hiding one isn't.
const ALL_ENABLED = { shop: true, services: true, bus: true, ride: true, jobs: true, events: true };

export function useEnabledModules() {
  const [modules, setModules] = useState(ALL_ENABLED);
  useEffect(() => {
    let active = true;
    getEnabledModules()
      .then((data) => active && setModules({ ...ALL_ENABLED, ...data }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return modules;
}
