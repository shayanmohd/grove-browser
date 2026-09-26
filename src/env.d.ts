import type { KamapathyBridge } from "../shared/types";
declare global {
  interface Window {
    kamapathy?: KamapathyBridge;
  }
}
