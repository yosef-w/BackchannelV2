import {
    classifyResume,
    getExtractedResumeText,
    uploadAndParseResume,
} from "@/lib/api";
import { trackResumeReuploaded } from "@/lib/analytics/mixpanel";
import { Sentry } from "@/lib/sentry";
import { useUserProfileStore } from "@/stores/useUserProfileStore";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useRef, useState } from "react";

// Matches the onboarding uploader's cap (ApplicantQuestionnaire.tsx) — this
// screen had no size guard at all, so a résumé too large to realistically
// finish in time could be attempted here even though onboarding would have
// rejected it up front.
const RESUME_MAX_SIZE_BYTES = 10 * 1024 * 1024;

// Generous upper bound on how long the backend could still be legitimately
// working on a résumé request after OUR request has already failed here
// (timed out, or the connection was dropped) — see attemptLateRecovery.
// Reconciled against the backend's own per-call ceilings (extraction ~90s
// read timeout, classify ~60s, both now max_retries=0 so that's a real
// ceiling and not a silent multiple of it — see the backend's
// fix/resume-parse-timeout-race) plus room for upload/CDN/DB overhead.
const REQUEST_CEILING_MS = 130_000;

/**
 * The resume upload -> parse -> AI-classify -> refetch pipeline, extracted
 * verbatim from ProfileView. Owns all resume-upload state (step machine,
 * elapsed ticker, abort controller, last-updated stamp) and the mount-time
 * status fetch; ProfileView just renders what this returns.
 */
export function useResumePipeline(userType: "applicant" | "sponsor") {
  const fetchFromBackend = useUserProfileStore(
    (state) => state.fetchFromBackend,
  );

  // Resume upload state
  const [resumeUploadStep, setResumeUploadStep] = useState<
    "idle" | "uploading" | "analyzing" | "done" | "error"
  >("idle");
  const [resumeFieldsUpdated, setResumeFieldsUpdated] = useState<string[]>([]);
  const [resumeLastUpdated, setResumeLastUpdated] = useState<string | null>(
    null,
  );
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(
    null,
  );
  const [resumeElapsedSecs, setResumeElapsedSecs] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Identifies the "current" upload attempt. Bumped whenever a new upload
  // starts (or the user explicitly cancels), so a request from a
  // now-superseded attempt that settles later — see attemptLateRecovery —
  // can tell nobody's watching this screen for it anymore and should
  // correct the store quietly instead of flipping the card the user is
  // currently looking at (e.g. mid-way through a fresh retry).
  const attemptIdRef = useRef(0);
  // False once ProfileView unmounts (it unmounts on tab blur — see
  // app/(tabs)/profile.tsx) so a recovery that resolves after the user has
  // navigated away doesn't call setState on an unmounted component.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load existing resume status on mount (applicant only)
  useEffect(() => {
    if (userType !== "applicant") return;
    console.log(
      "[Resume] 🔍 Fetching existing resume status (GET /api/resume/extracted-text/)...",
    );
    getExtractedResumeText()
      .then((r) => {
        console.log(
          "[Resume] ✅ Resume status response:",
          JSON.stringify(r, null, 2),
        );
        if (r.extracted_resume_text && r.updated_at)
          setResumeLastUpdated(r.updated_at);
        if (!r.extracted_resume_text) {
          console.log(
            "[Resume] ℹ️ No resume text on file yet — user hasn't uploaded a resume.",
          );
        } else {
          console.log(
            "[Resume] ℹ️ Existing resume text length:",
            r.extracted_resume_text.length,
            "chars. Last updated:",
            r.updated_at,
          );
        }
      })
      .catch((err) => {
        console.warn("[Resume] ⚠️ Could not fetch resume status:", err);
      });
  }, [userType]);

  // ── Resume helpers ──────────────────────────────────────────────────────────

  /** Stop the elapsed-seconds ticker and clean up the ref. */
  const stopElapsedTimer = () => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  /** Cancel an in-progress resume upload/classify and return to idle. */
  const cancelResumeUpload = () => {
    // The user explicitly said stop — even if the abandoned request
    // quietly succeeds server-side later (see attemptLateRecovery), don't
    // surface it as if this cancelled attempt had worked.
    attemptIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopElapsedTimer();
    setResumeElapsedSecs(0);
    setResumeUploadStep("idle");
  };

  const formatRelativeTime = (isoString: string): string => {
    // Normalize to UTC: backends often omit the timezone suffix, causing JS to
    // parse as local time and producing negative diffs for users behind UTC.
    const t = isoString.trim();
    const normalized =
      /Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/.test(t)
        ? isoString
        : `${isoString}Z`;
    const date = new Date(normalized);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    // Guard against clock skew / future timestamps.
    if (diffMs < 0) return "just now";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFieldName = (field: string): string =>
    field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const handleResumeUpload = async () => {
    // Supersede whatever attempt (if any) is still in flight: stop this
    // hook from reacting to it going forward, and stop listening on its
    // controller. The real request may keep running server-side regardless
    // (aborting a fetch doesn't cancel work already underway on the
    // backend) — that's fine, only the newest attempt should ever drive
    // this screen's UI; a late success from the old one still corrects the
    // store via its own attemptLateRecovery/finishSuccess if it had
    // already gotten far enough to register one.
    attemptIdRef.current += 1;
    const attemptId = attemptIdRef.current;
    const isCurrent = () =>
      attemptIdRef.current === attemptId && mountedRef.current;
    abortControllerRef.current?.abort();

    // Declared here (not inside the try below) so the catch block can
    // still reach whichever of these got set up before the failure —
    // otherwise a failure after `controller`/`attemptLateRecovery` are
    // assigned would have no way to trigger a recovery from the catch.
    let controller: AbortController | null = null;
    let phaseStartedAt = 0;
    let attemptLateRecovery: ((phaseStartedAt: number) => Promise<void>) | null =
      null;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        console.log("[Resume] ℹ️ File picker cancelled or no file selected.");
        return;
      }

      const file = result.assets[0];
      console.log("[Resume] 📄 File selected:", {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        uri: file.uri,
      });

      if (file.size && file.size > RESUME_MAX_SIZE_BYTES) {
        setResumeUploadStep("error");
        setResumeUploadError(
          "That résumé is over 10 MB — please upload a smaller file.",
        );
        return;
      }

      // Fresh abort controller for this upload session
      controller = new AbortController();
      abortControllerRef.current = controller;
      const activeController = controller;

      // Start elapsed-seconds ticker
      setResumeElapsedSecs(0);
      elapsedTimerRef.current = setInterval(() => {
        setResumeElapsedSecs((s) => s + 1);
      }, 1000);

      // Wraps any promise with a hard timeout so the UI never spins forever.
      // Losing this race doesn't cancel the underlying request — it's still
      // running when this rejects — see attemptLateRecovery below for what
      // happens to that abandoned result.
      const withTimeout = <T,>(
        promise: Promise<T>,
        ms: number,
        label: string,
      ): Promise<T> =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `${label} is taking too long (>${ms / 1000}s). We'll keep checking in the background and update this automatically if it finishes.`,
                  ),
                ),
              ms,
            ),
          ),
        ]);

      setResumeUploadStep("uploading");
      setResumeUploadError(null);
      trackResumeReuploaded();

      const form = new FormData();
      form.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/pdf",
        // RN FormData file descriptor — see the image upload above.
      } as any);

      // Shared success landing spot for both the normal (in-budget) path
      // and a late recovery. Always refreshes the store — so the cached
      // profile is never left wrong regardless of what this screen is
      // showing — but only touches THIS screen's own step/error/fields UI
      // if a newer attempt hasn't since superseded it and it's still
      // mounted (see isCurrent above).
      const finishSuccess = async (fieldsUpdated: string[]) => {
        console.log(
          "[Resume] 🔄 Refreshing profile from backend to reflect AI-updated fields...",
        );
        await fetchFromBackend();
        console.log("[Resume] ✅ Profile refresh complete.");
        if (!isCurrent()) {
          console.log(
            "[Resume] ℹ️ Attempt superseded/unmounted — store corrected, but not touching the screen.",
          );
          return;
        }
        stopElapsedTimer();
        setResumeElapsedSecs(0);
        abortControllerRef.current = null;
        setResumeFieldsUpdated(fieldsUpdated);
        setResumeUploadStep("done");
        setResumeLastUpdated(new Date().toISOString());
        setResumeUploadError(null);

        const { data: stored } = useUserProfileStore.getState();
        console.log(
          "[Resume] 🖥️ DISPLAY STATE — experiences:",
          stored.professional.experiences.length,
          "education:",
          stored.education.entries.length,
          "skills:",
          stored.skills.length,
        );
      };

      // Called when a phase's outcome is AMBIGUOUS — a client-side timeout,
      // or any other non-definitive failure (e.g. a dropped connection) —
      // as opposed to a fast, backend-confirmed "this file really can't be
      // parsed" answer. In the ambiguous case the backend may well still
      // be working (or may have already finished) when we gave up on it;
      // wait out a generous, elapsed-aware remainder of its realistic
      // worst case, then check whether it actually landed, and if so
      // finish the pipeline from wherever it left off instead of leaving
      // the screen stuck on a stale error for something that succeeded.
      attemptLateRecovery = async (startedAt: number) => {
        const elapsed = Date.now() - startedAt;
        const waitMs = Math.max(15_000, REQUEST_CEILING_MS - elapsed);
        console.log(
          `[Resume] ⏳ Ambiguous failure — rechecking in ${Math.round(waitMs / 1000)}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        if (!isCurrent()) return;
        try {
          const status = await getExtractedResumeText();
          if (!status.extracted_resume_text) {
            console.log(
              "[Resume] ℹ️ Late recheck: still no extracted text — this one genuinely didn't land.",
            );
            return;
          }
          // Text is present now (freshly landed, or was already there from
          // before an ambiguous classify-phase failure) — (re-)classify is
          // safe to call again even if an earlier attempt secretly
          // succeeded too, since it just recomputes from the same stored
          // text and overwrites with an equivalent result.
          console.log(
            "[Resume] ✅ Late recheck found extracted text — resuming with classify.",
          );
          const classifyResult = await classifyResume(activeController.signal);
          const allUpdated = [
            ...(classifyResult.applicant_fields_updated || []),
            ...(classifyResult.user_fields_updated || []),
          ];
          await finishSuccess(allUpdated);
        } catch (err) {
          const name = err instanceof Error ? err.name : "";
          if (name === "AbortError") return; // superseded/cancelled meanwhile — expected
          console.warn("[Resume] ❌ Late recovery failed:", err);
          Sentry.captureException(err, {
            tags: { flow: "resume_upload_late_recovery" },
          });
        }
      };

      phaseStartedAt = Date.now();
      console.log("[Resume] 📤 Uploading to POST /api/upload-and-parse/ ...");
      const parseResult = await withTimeout(
        uploadAndParseResume(form, activeController.signal),
        120_000,
        "Resume upload",
      );
      console.log("[Resume] ✅ Upload+parse response:", {
        message: parseResult.message,
        parsing_error: parseResult.parsing_error,
        extracted_text_length: parseResult.extracted_text?.length ?? 0,
      });

      // The backend returns HTTP 201 even when text extraction fails
      // (extracted_text will be null). This is a fast, definitive answer
      // from the backend — not a race — so it's flagged as such and skips
      // the late-recovery path entirely (see the catch block below).
      if (!parseResult.extracted_text) {
        const serverMsg: string | undefined =
          parseResult.parsing_error ?? undefined;
        console.warn(
          "[Resume] ❌ Text extraction failed — extracted_text is null. parsing_error:",
          serverMsg,
        );
        const isServiceError =
          serverMsg?.includes("please try again") ||
          serverMsg?.includes("unavailable") ||
          serverMsg?.includes("configured");
        const err: Error & { resumeDefinitiveFailure?: boolean } = new Error(
          isServiceError
            ? `Resume uploaded but text could not be read — ${serverMsg}`
            : "Resume uploaded but text extraction failed. Please try a PDF with selectable (non-scanned) text.",
        );
        err.resumeDefinitiveFailure = true;
        throw err;
      }

      if (isCurrent()) setResumeUploadStep("analyzing");
      phaseStartedAt = Date.now();
      console.log("[Resume] 🤖 Calling POST /api/resume/classify/ ...");
      const classifyResult = await withTimeout(
        classifyResume(activeController.signal),
        120_000,
        "AI analysis",
      );
      console.log("[Resume] ✅ Classify response:", {
        message: classifyResult.message,
        applicant_fields_updated: classifyResult.applicant_fields_updated,
        user_fields_updated: classifyResult.user_fields_updated,
      });

      const allUpdated = [
        ...(classifyResult.applicant_fields_updated || []),
        ...(classifyResult.user_fields_updated || []),
      ];
      await finishSuccess(allUpdated);
    } catch (err) {
      stopElapsedTimer();
      setResumeElapsedSecs(0);
      const errName = err instanceof Error ? err.name : "";
      const errMessage = err instanceof Error ? err.message : "";

      // User pressed Cancel (or a newer attempt superseded this one) —
      // abort silently, return to idle.
      if (errName === "AbortError") {
        console.log("[Resume] ℹ️ Upload cancelled/superseded.");
        abortControllerRef.current = null;
        if (isCurrent()) setResumeUploadStep("idle");
        return;
      }

      console.warn(
        "[Resume] ❌ Resume upload pipeline failed:",
        errMessage,
        err,
      );
      // The résumé pipeline (upload → parse → AI classify → refetch) is the
      // applicant onboarding centerpiece and has the most moving parts —
      // failures here should page the dashboard, not just show a toast.
      Sentry.captureException(err, { tags: { flow: "resume_upload" } });
      if (isCurrent()) {
        setResumeUploadStep("error");
        setResumeUploadError(errMessage || "Upload failed. Please try again.");
      }

      const isDefinitive =
        (err as { resumeDefinitiveFailure?: boolean } | null)
          ?.resumeDefinitiveFailure === true;
      if (!isDefinitive && attemptLateRecovery) {
        // Ambiguous — the backend might still finish this successfully.
        // Fire-and-forget: the recovery itself is responsible for deciding
        // whether it's still relevant by the time it resolves.
        void attemptLateRecovery(phaseStartedAt);
      } else {
        abortControllerRef.current = null;
      }
    }
  };

  return {
    resumeUploadStep,
    setResumeUploadStep,
    resumeFieldsUpdated,
    resumeLastUpdated,
    resumeUploadError,
    resumeElapsedSecs,
    handleResumeUpload,
    cancelResumeUpload,
    formatRelativeTime,
    formatFieldName,
  };
}
