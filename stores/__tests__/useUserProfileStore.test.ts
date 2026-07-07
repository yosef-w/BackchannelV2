/**
 * Contract tests for the profile store's sync machinery — the rules that
 * previously existed only in comments (and whose violation caused the
 * blank-name incident):
 *   1. edits mark their field GROUP dirty and queue a sync
 *   2. seedSessionEmail is session bookkeeping — never dirties, never syncs
 *   3. a successful sync clears exactly what was sent and resets failures
 *   4. a field edited while a sync is in flight STAYS dirty (no lost edit)
 *   5. offline failures don't count toward the abandon threshold;
 *      non-network failures do
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../lib/sentry", () => ({
  Sentry: { captureException: jest.fn() },
}));
jest.mock("../../lib/auth-api", () => ({
  authApi: { updateProfile: jest.fn() },
}));

import { authApi } from "../../lib/auth-api";
import { useUserProfileStore } from "../useUserProfileStore";

const mockUpdateProfile = authApi.updateProfile as jest.Mock;

const store = () => useUserProfileStore.getState();

// Fake timers for the whole suite: every updatePersonal queues a 2s
// debounced sync via setTimeout, and a real timer would keep the jest
// process alive after the run. With fake timers the debounce simply never
// fires (we call syncToBackend directly), and no open handles remain.
beforeAll(() => {
  jest.useFakeTimers();
});
afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockUpdateProfile.mockResolvedValue(undefined);
  await AsyncStorage.clear();
  // Reset the sync-relevant slice between tests (module-scope zustand store
  // persists across tests otherwise).
  useUserProfileStore.setState({
    dirtyFields: new Set(),
    needsSync: false,
    isSyncing: false,
    syncError: null,
    syncFailureCount: 0,
  });
});

describe("dirty tracking", () => {
  it("updatePersonal marks the personal group dirty and flags needsSync", async () => {
    await store().updatePersonal({ firstName: "Sarah" });
    expect(store().dirtyFields.has("personal")).toBe(true);
    expect(store().needsSync).toBe(true);
    expect(store().data.personal.firstName).toBe("Sarah");
  });

  it("updatePersonal recomputes fullName from first + last", async () => {
    await store().updatePersonal({ firstName: "Sarah", lastName: "Chen" });
    expect(store().data.personal.fullName).toBe("Sarah Chen");
  });

  it("seedSessionEmail sets the email WITHOUT dirtying or queueing a sync", async () => {
    await store().seedSessionEmail("sarah@example.com");
    expect(store().data.personal.email).toBe("sarah@example.com");
    // The blank-name regression: login used to blank+dirty the personal
    // group, which then PATCHed empty names to the backend. Session email
    // seeding must never enter the sync pipeline.
    expect(store().dirtyFields.size).toBe(0);
    expect(store().needsSync).toBe(false);
  });
});

describe("syncToBackend", () => {
  it("is a no-op when nothing is dirty", async () => {
    await store().syncToBackend();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("sends the dirty field groups and clears them on success", async () => {
    mockUpdateProfile.mockResolvedValueOnce(undefined);
    await store().updatePersonal({ firstName: "Sarah" });
    await store().syncToBackend();

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    const [sentData, sentFields] = mockUpdateProfile.mock.calls[0];
    expect(sentFields).toEqual(new Set(["personal"]));
    expect(sentData.personal.firstName).toBe("Sarah");

    expect(store().dirtyFields.size).toBe(0);
    expect(store().needsSync).toBe(false);
    expect(store().syncError).toBeNull();
    expect(store().syncFailureCount).toBe(0);
  });

  it("keeps a group dirty when it's edited while the sync is in flight", async () => {
    await store().updatePersonal({ firstName: "Sarah" });

    // updateProfile resolves only after we sneak in a mid-flight edit.
    let release!: () => void;
    mockUpdateProfile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve();
        }),
    );

    const syncPromise = store().syncToBackend();
    while (mockUpdateProfile.mock.calls.length === 0) {
      await Promise.resolve();
    }
    await store().updatePersonal({ firstName: "Sarah-edited" });
    release();
    await syncPromise;

    // The newer value must not be dropped — personal stays dirty and goes
    // out on the next sync.
    expect(store().dirtyFields.has("personal")).toBe(true);
    expect(store().needsSync).toBe(true);
    expect(store().data.personal.firstName).toBe("Sarah-edited");
  });

  it("treats offline failures as retriable without counting toward abandonment", async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error("network request failed"));
    await store().updatePersonal({ firstName: "Sarah" });
    await store().syncToBackend();

    expect(store().syncError).toBe("offline");
    expect(store().syncFailureCount).toBe(0); // untouched
    expect(store().needsSync).toBe(true);
    expect(store().dirtyFields.has("personal")).toBe(true);
  });

  it("counts non-network failures toward the abandon threshold", async () => {
    mockUpdateProfile.mockRejectedValue(new Error("400 bad payload"));
    await store().updatePersonal({ firstName: "Sarah" });

    await store().syncToBackend();
    expect(store().syncFailureCount).toBe(1);
    await store().syncToBackend();
    expect(store().syncFailureCount).toBe(2);

    // The dirty flag survives failures — nothing is silently dropped.
    expect(store().dirtyFields.has("personal")).toBe(true);
    expect(store().syncError).toBe("400 bad payload");
  });

  it("does not double-sync while a request is already in flight", async () => {
    await store().updatePersonal({ firstName: "Sarah" });
    let release!: () => void;
    mockUpdateProfile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve();
        }),
    );
    const first = store().syncToBackend();
    // syncToBackend awaits a dynamic import before hitting the API — flush
    // microtasks until the in-flight request exists, then start the second.
    while (mockUpdateProfile.mock.calls.length === 0) {
      await Promise.resolve();
    }
    const second = store().syncToBackend(); // isSyncing guard → no-op
    release();
    await Promise.all([first, second]);
    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
  });
});
