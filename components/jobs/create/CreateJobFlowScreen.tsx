import { normalizeUrl } from "@/lib/validation";
import React, { useEffect, useState } from "react";
import { Modal, SafeAreaView, StyleSheet } from "react-native";
import {
    CreateJobInsightsScreen,
    CreateJobSuccessScreen,
} from "./CreateJobInsightsScreen";
import { CreateJobFetchingScreen, type ScrapedJobData } from "./CreateJobFetchingScreen";
import { CreateJobReviewScreen, type EditableJobFields } from "./CreateJobReviewScreen";
import { CreateJobUrlScreen } from "./CreateJobUrlScreen";

type Step = "url" | "fetching" | "review" | "insights";

export interface CreateJobPublishPayload {
  url: string;
  structured: Record<string, string | null> | null;
  rawText: string;
  insights: {
    dayToDay: string;
    teamCulture: string;
    idealCandidate: string;
    insiderInsights: string;
  };
}

interface CreateJobFlowScreenProps {
  visible: boolean;
  onClose: () => void;
  isPublishing: boolean;
  onPublish: (payload: CreateJobPublishPayload) => void;
  /** Parent flips this true once createJobFromUrl resolves — the flow shows
   * the success screen instead of managing its own "did it work" state, so
   * JobsView stays the single source of truth for the actual API call. */
  published: boolean;
  onDone: () => void;
}

const EMPTY_FIELDS: EditableJobFields = {
  title: "",
  company: "",
  location: "",
  salary: "",
  type: "",
  description: "",
};

const EMPTY_INSIGHTS = {
  dayToDay: "",
  teamCulture: "",
  idealCandidate: "",
  insiderInsights: "",
};

/**
 * Create-a-job-from-URL, reimagined as a pushed full-screen flow (matching
 * the Account/Edit Profile family) instead of a chain of bottom sheets and
 * a full-screen browser. Four steps:
 *   1. Paste the link (CreateJobUrlScreen)
 *   2. Watch the listing build itself while we read the page
 *      (CreateJobFetchingScreen — WebView runs invisibly; a JobPreviewCard
 *      fills in field-by-field instead of a spinner)
 *   3. Review + fix anything the scrape got wrong (CreateJobReviewScreen)
 *   4. Add the insider insights only the sponsor can write, then publish
 *      (CreateJobInsightsScreen)
 *
 * All four steps share this one Modal — no more three separate modals with
 * three different animation styles chained together.
 */
export function CreateJobFlowScreen({
  visible,
  onClose,
  isPublishing,
  onPublish,
  published,
  onDone,
}: CreateJobFlowScreenProps) {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [normalizedUrl, setNormalizedUrl] = useState("");
  const [scraped, setScraped] = useState<ScrapedJobData | null>(null);
  const [fields, setFields] = useState<EditableJobFields>(EMPTY_FIELDS);
  const [insights, setInsights] = useState(EMPTY_INSIGHTS);

  // Reset to a clean slate every time the flow is (re)opened.
  useEffect(() => {
    if (visible) {
      setStep("url");
      setUrl("");
      setNormalizedUrl("");
      setScraped(null);
      setFields(EMPTY_FIELDS);
      setInsights(EMPTY_INSIGHTS);
    }
  }, [visible]);

  if (!visible) return null;

  const handleUrlContinue = () => {
    setNormalizedUrl(normalizeUrl(url.trim()));
    setStep("fetching");
  };

  const handleScraped = (data: ScrapedJobData) => {
    setScraped(data);
    setFields({
      title: data.structured?.title || "",
      company: data.structured?.company || "",
      location: data.structured?.location || "",
      salary: data.structured?.salary || "",
      type: formatEmploymentType(data.structured?.employmentType ?? null),
      description: data.structured?.description || "",
    });
    setStep("review");
  };

  const handleReviewContinue = (edited: EditableJobFields) => {
    setFields(edited);
    setStep("insights");
  };

  const handlePublish = () => {
    onPublish({
      url: scraped?.url ?? normalizedUrl,
      structured: {
        title: fields.title || null,
        company: fields.company || null,
        location: fields.location || null,
        description: fields.description || null,
        employmentType: fields.type || null,
        salary: fields.salary || null,
        datePosted: scraped?.structured?.datePosted ?? null,
      },
      rawText: scraped?.rawText ?? "",
      insights,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {published ? (
          <CreateJobSuccessScreen
            visible
            jobTitle={fields.title}
            onDone={onDone}
          />
        ) : (
          <>
            <CreateJobUrlScreen
              visible={step === "url"}
              url={url}
              onSetUrl={setUrl}
              onContinue={handleUrlContinue}
              onClose={onClose}
            />
            <CreateJobFetchingScreen
              visible={step === "fetching"}
              url={normalizedUrl}
              onContinue={handleScraped}
              onBack={() => setStep("url")}
              onClose={onClose}
            />
            <CreateJobReviewScreen
              visible={step === "review"}
              initial={fields}
              wasAutoFilled={!!scraped?.structured}
              onContinue={handleReviewContinue}
              onBack={() => setStep("url")}
              onClose={onClose}
            />
            <CreateJobInsightsScreen
              visible={step === "insights"}
              jobTitle={fields.title}
              values={insights}
              onChange={(key, text) =>
                setInsights((prev) => ({ ...prev, [key]: text }))
              }
              isPublishing={isPublishing}
              onPublish={handlePublish}
              onBack={() => setStep("review")}
              onClose={onClose}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF" },
});

/** Rough employment-type label from JSON-LD's SCREAMING_SNAKE_CASE enum. */
function formatEmploymentType(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
