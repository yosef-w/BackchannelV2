// newSideResume — the optional résumé from "add a job search"
// (components/sides/AddSideScreen), read after the new side exists.
//
// It can't be uploaded from the setup screen itself: the upload writes to
// the job-search profile, which only exists once the side is added, and
// every request has to carry the job-search side's X-Active-Role — so it
// runs after the switch. By then the setup screen is gone, so this lives
// outside React and reports through toasts. Same upload → parse →
// classify → refetch steps as the Account tab's résumé card
// (components/profile/useResumePipeline), without its retry machinery: a
// failure here just points to that card, which has it.

import { classifyResume, uploadAndParseResume } from "@/lib/api";
import { Sentry } from "@/lib/sentry";
import { useToastStore } from "@/stores/useToastStore";
import { useUserProfileStore } from "@/stores/useUserProfileStore";

/** Same cap as onboarding and the Account tab's uploader. */
export const NEW_SIDE_RESUME_MAX_BYTES = 10 * 1024 * 1024;

export interface PickedResume {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

/** Fire and forget: reports its own outcome. */
export async function readResumeForNewSide(file: PickedResume): Promise<void> {
  const toast = useToastStore.getState().showToast;
  toast("Reading your résumé. Your profile fills in when it's done.", "info");
  try {
    const form = new FormData();
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/pdf",
      // RN FormData file descriptor, as in useResumePipeline.
    } as unknown as Blob);
    const parsed = await uploadAndParseResume(form);
    if (!parsed.extracted_text) {
      throw new Error(parsed.parsing_error || "no text extracted");
    }
    await classifyResume();
    await useUserProfileStore.getState().fetchFromBackend();
    toast("Résumé added. Your job-search profile is filled in.", "success");
  } catch (err) {
    console.warn("[NewSideResume] Résumé read failed:", err);
    Sentry.captureException(err, { tags: { flow: "new_side_resume" } });
    toast(
      "We couldn't read that résumé. You can add it from the Account tab.",
      "error",
    );
  }
}
