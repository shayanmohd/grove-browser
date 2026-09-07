import type { GroveBridge } from "../shared/types";
declare global {
  interface Window {
    grove?: GroveBridge;
  }
}
