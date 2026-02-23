import { registerLicense } from "@syncfusion/ej2-base";

let registered = false;

export function ensureSyncfusionLicense() {
  if (registered) return;
  const key = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY;
  if (key) {
    registerLicense(key);
    registered = true;
  }
}

// Auto-register on import (client-side)
if (typeof window !== "undefined") {
  ensureSyncfusionLicense();
}
