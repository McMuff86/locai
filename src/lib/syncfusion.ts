import { registerLicense } from "@syncfusion/ej2-base";

let registered = false;

export function registerSyncfusionLicense(key: string) {
  if (!registered) {
    registerLicense(key);
    registered = true;
  }
}
