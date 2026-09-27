/**
 * "Offline" must be conservative: NetInfo reports `isInternetReachable:
 * null` while it's still probing, and reading that as "offline" would flash
 * a scary banner on every cold start.
 */
import { isOfflineFrom } from "../network";

describe("isOfflineFrom", () => {
  it("is online when connected and reachable", () => {
    expect(isOfflineFrom({ isConnected: true, isInternetReachable: true })).toBe(false);
  });

  it("does NOT treat 'still probing' (null) as offline", () => {
    expect(isOfflineFrom({ isConnected: true, isInternetReachable: null })).toBe(false);
    expect(isOfflineFrom({ isConnected: null, isInternetReachable: null })).toBe(false);
  });

  it("is offline when there's no connection", () => {
    expect(isOfflineFrom({ isConnected: false, isInternetReachable: false })).toBe(true);
    expect(isOfflineFrom({ isConnected: false, isInternetReachable: null })).toBe(true);
  });

  it("is offline when connected to a network with no internet", () => {
    expect(isOfflineFrom({ isConnected: true, isInternetReachable: false })).toBe(true);
  });
});
