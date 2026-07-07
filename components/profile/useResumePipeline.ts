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

      // Fresh abort controller for this upload session
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Start elapsed-seconds ticker
      setResumeElapsedSecs(0);
      elapsedTimerRef.current = setInterval(() => {
        setResumeElapsedSecs((s) => s + 1);
      }, 1000);

      // Wraps any promise with a hard timeout so the UI never spins forever.
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
                    `${label} is taking too long (>${ms / 1000}s). The server may be busy — please try again.`,
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
      console.log("[Resume] 📤 Uploading to POST /api/upload-and-parse/ ...");
      // 60s timeout for upload + Snowflake text extraction
      const parseResult = await withTimeout(
        uploadAndParseResume(form, controller.signal),
        60_000,
        "Resume upload",
      );
      console.log("[Resume] ✅ Upload+parse response:", {
        message: parseResult.message,
        parsing_error: parseResult.parsing_error,
        extracted_text_length: parseResult.extracted_text?.length ?? 0,
        extracted_text_preview: parseResult.extracted_text?.slice(0, 200),
      });

      // The backend returns HTTP 201 even when text extraction fails
      // (extracted_text will be null). Use parsing_error to surface a relevant
      // message: transient service errors → "try again"; format errors → PDF hint.
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
        throw new Error(
          isServiceError
            ? `Resume uploaded but text could not be read — ${serverMsg}`
            : "Resume uploaded but text extraction failed. Please try a PDF with selectable (non-scanned) text.",
        );
      }

      setResumeUploadStep("analyzing");
      console.log("[Resume] 🤖 Calling POST /api/resume/classify/ ...");
      // 120s timeout for AI classification (Snowflake Cortex can be slow)
      const classifyResult = await withTimeout(
        classifyResume(controller.signal),
        120_000,
        "AI analysis",
      );
      console.log("[Resume] ✅ Classify response:", {
        message: classifyResult.message,
        applicant_fields_updated: classifyResult.applicant_fields_updated,
        user_fields_updated: classifyResult.user_fields_updated,
        classified_data: classifyResult.classified_data,
      });

      stopElapsedTimer();
      setResumeElapsedSecs(0);
      abortControllerRef.current = null;

      const allUpdated = [
        ...(classifyResult.applicant_fields_updated || []),
        ...(classifyResult.user_fields_updated || []),
      ];
      console.log("[Resume] ✅ Total fields populated by AI:", allUpdated);
      setResumeFieldsUpdated(allUpdated);
      setResumeUploadStep("done");
      setResumeLastUpdated(new Date().toISOString());

      // Refresh the store so AI-updated fields appear immediately
      console.log(
        "[Resume] 🔄 Refreshing profile from backend to reflect AI-updated fields...",
      );
      await fetchFromBackend();
      console.log("[Resume] ✅ Profile refresh complete.");

      // ── DISPLAY STATE SNAPSHOT ───────────────────────────────────────────
      // What the UI will actually render after the refresh
      const { data: stored } = useUserProfileStore.getState();
      console.log("[Resume] 🖥️ DISPLAY STATE — what the UI will show:");
      console.log(
        "[Resume]   👤 Identity:",
        JSON.stringify(
          {
            firstName: stored.personal.firstName,
            lastName: stored.personal.lastName,
            email: stored.personal.email,
            phone: stored.personal.phone,
            portfolio: stored.personal.portfolio,
            profileImage: stored.personal.profileImage,
            city: stored.personal.address?.city,
            state: stored.personal.address?.state,
          },
          null,
          2,
        ),
      );
      console.log(
        "[Resume]   💼 Professional summary:",
        JSON.stringify(
          {
            currentRole: stored.professional.currentRole,
            title: stored.professional.title,
            yearsExperience: stored.professional.yearsExperience,
            targetIndustry: stored.professional.targetIndustry,
            bio: stored.professional.summary,
            achievements: stored.achievements,
          },
          null,
          2,
        ),
      );
      console.log(
        "[Resume]   🏢 Work experiences (" +
          stored.professional.experiences.length +
          " entries):",
        JSON.stringify(
          stored.professional.experiences.map((e, i) => ({
            "#": i + 1,
            jobTitle: e.jobTitle,
            company: e.company,
            startDate: e.startDate,
            endDate: e.endDate,
            current: e.current,
            description:
              e.description?.slice(0, 80) +
              (e.description?.length > 80 ? "..." : ""),
          })),
          null,
          2,
        ),
      );
      console.log(
        "[Resume]   🎓 Education entries (" +
          stored.education.entries.length +
          " entries):",
        JSON.stringify(
          stored.education.entries.map((e, i) => ({
            "#": i + 1,
            degree: e.degree,
            major: e.major,
            university: e.university,
            graduationYear: e.graduationYear,
            gpa: e.gpa,
          })),
          null,
          2,
        ),
      );
      console.log(
        "[Resume]   🛠️ Skills (" + stored.skills.length + " items):",
        stored.skills,
      );
      console.log(
        "[Resume]   📜 Certifications (" +
          stored.certifications.length +
          " entries):",
        JSON.stringify(stored.certifications, null, 2),
      );
      console.log(
        "[Resume]   🗣️ Languages (" + stored.languages.length + " entries):",
        JSON.stringify(stored.languages, null, 2),
      );
      // ─────────────────────────────────────────────────────────────────────
    } catch (err) {
      stopElapsedTimer();
      setResumeElapsedSecs(0);
      abortControllerRef.current = null;
      const errName = err instanceof Error ? err.name : "";
      const errMessage = err instanceof Error ? err.message : "";

      // User pressed Cancel — abort silently, return to idle
      if (errName === "AbortError") {
        console.log("[Resume] ℹ️ Upload cancelled by user.");
        setResumeUploadStep("idle");
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
      setResumeUploadStep("error");
      setResumeUploadError(errMessage || "Upload failed. Please try again.");
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
