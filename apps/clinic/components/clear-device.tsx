"use client";

import { clearOfflineData } from "@corex/core/offline/react";
import { useEffect } from "react";

/** After a session ends on its own, removes local data from the device (SPEC.md 10.2). */
export function ClearDevice() {
  useEffect(() => {
    void clearOfflineData("clinic");
  }, []);
  return null;
}
