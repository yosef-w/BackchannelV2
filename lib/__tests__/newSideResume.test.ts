const mockToasts: [string, string | undefined][] = [];
jest.mock("@/stores/useToastStore", () => ({
  useToastStore: {
    getState: () => ({ showToast: (m: string, v?: string) => mockToasts.push([m, v]) }),
  },
}));
const mockFetch = jest.fn(async () => {});
jest.mock("@/stores/useUserProfileStore", () => ({
  useUserProfileStore: { getState: () => ({ fetchFromBackend: mockFetch }) },
}));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));
const mockUpload = jest.fn();
const mockClassify = jest.fn();
jest.mock("@/lib/api", () => ({
  uploadAndParseResume: (...a: unknown[]) => mockUpload(...a),
  classifyResume: (...a: unknown[]) => mockClassify(...a),
}));

import { readResumeForNewSide } from "../newSideResume";

const FILE = { uri: "file:///r.pdf", name: "r.pdf", mimeType: "application/pdf", size: 1000 };

beforeEach(() => {
  mockToasts.length = 0;
  mockFetch.mockClear();
  mockUpload.mockReset();
  mockClassify.mockReset();
});

describe("readResumeForNewSide", () => {
  it("uploads, classifies, refreshes the profile and says so", async () => {
    mockUpload.mockResolvedValue({ message: "ok", extracted_text: "text" });
    mockClassify.mockResolvedValue({});
    await readResumeForNewSide(FILE);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockClassify).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockToasts.at(-1)).toEqual(["Résumé added. Your job-search profile is filled in.", "success"]);
  });

  it("points to the Account tab when the file can't be read, without classifying", async () => {
    mockUpload.mockResolvedValue({ message: "x", extracted_text: null, parsing_error: "scanned" });
    await readResumeForNewSide(FILE);
    expect(mockClassify).not.toHaveBeenCalled();
    expect(mockToasts.at(-1)?.[1]).toBe("error");
    expect(mockToasts.at(-1)?.[0]).toMatch(/Account tab/);
  });

  it("never throws on a network failure", async () => {
    mockUpload.mockRejectedValue(new Error("offline"));
    await expect(readResumeForNewSide(FILE)).resolves.toBeUndefined();
    expect(mockToasts.at(-1)?.[1]).toBe("error");
  });
});
