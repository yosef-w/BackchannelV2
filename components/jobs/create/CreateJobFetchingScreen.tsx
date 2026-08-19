import { ChevronLeft, ChevronRight, Eye, Globe } from "@/components/ui/icons";
import React, { useEffect, useRef, useState } from "react";
import {
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { WebView } from "react-native-webview";
import { CreateJobStepHeader } from "./CreateJobStepHeader";
import { JobPreviewCard, type JobPreviewFields } from "./JobPreviewCard";
import { Colors } from "@/constants/theme";

export interface ScrapedJobData {
  url: string;
  structured: Record<string, string | null> | null;
  rawText: string;
}

interface CreateJobFetchingScreenProps {
  visible: boolean;
  url: string;
  onContinue: (data: ScrapedJobData) => void;
  onBack: () => void;
  onClose: () => void;
}

// Injected JS: tries JSON-LD JobPosting schema first, supplements with OG
// meta tags, then falls back to body.innerText. Unchanged from the original
// modal-based flow's scraper — only when it runs has changed (see below).
const JOB_SCRAPING_SCRIPT = `
  (function() {
    try {
      var structured = null;

      var ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < ldScripts.length; i++) {
        try {
          var parsed = JSON.parse(ldScripts[i].textContent || ldScripts[i].innerText || '');
          var items = Array.isArray(parsed) ? parsed : [parsed];
          for (var j = 0; j < items.length; j++) {
            var item = items[j];
            if (item['@type'] === 'JobPosting') {
              var salaryNode = item.baseSalary;
              var salaryStr = null;
              if (salaryNode && salaryNode.value) {
                var sv = salaryNode.value;
                salaryStr = (sv.minValue || '') + (sv.maxValue ? ' - ' + sv.maxValue : '') + (salaryNode.currency ? ' ' + salaryNode.currency : '');
                salaryStr = salaryStr.trim() || null;
              }
              var locNode = item.jobLocation;
              var locStr = null;
              if (locNode) {
                var addr = Array.isArray(locNode) ? locNode[0] : locNode;
                if (addr && addr.address) {
                  locStr = [addr.address.addressLocality, addr.address.addressRegion, addr.address.addressCountry]
                    .filter(Boolean).join(', ') || null;
                }
              }
              structured = {
                title: item.title || null,
                company: (item.hiringOrganization && item.hiringOrganization.name) || null,
                location: locStr,
                description: item.description || null,
                employmentType: Array.isArray(item.employmentType)
                  ? (item.employmentType[0] || null)
                  : (item.employmentType || null),
                salary: salaryStr,
                datePosted: item.datePosted || null,
              };
              break;
            }
          }
          if (structured) break;
        } catch(e) {}
      }

      if (!structured) {
        var getMeta = function(sel) {
          var el = document.querySelector(sel);
          return el ? (el.getAttribute('content') || null) : null;
        };
        var ogTitle = getMeta('meta[property="og:title"]') || getMeta('meta[name="title"]');
        var ogDesc  = getMeta('meta[property="og:description"]') || getMeta('meta[name="description"]');
        var ogSite  = getMeta('meta[property="og:site_name"]');
        if (ogTitle || ogDesc) {
          structured = {
            title: ogTitle,
            company: ogSite,
            location: null,
            description: ogDesc,
            employmentType: null,
            salary: null,
            datePosted: null,
          };
        }
      }

      var rawText = (document.body && document.body.innerText) || '';
      if (rawText.length > 60000) rawText = rawText.slice(0, 60000);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'JOB_CONTENT_SCRAPED',
        data: { url: window.location.href, structured: structured, rawText: rawText }
      }));
    } catch(err) {
      var fallbackText = '';
      try { fallbackText = (document.body && document.body.innerText.slice(0, 60000)) || ''; } catch(e2) {}
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'JOB_CONTENT_SCRAPED',
        data: { url: window.location.href, structured: null, rawText: fallbackText }
      }));
    }
    true;
  })();
`;

// Delay before each scrape attempt (measured from the previous one), after
// onLoadEnd. Client-rendered job boards can take several seconds past "load"
// to put JSON-LD in the DOM; ~12s of patience total before giving up.
const SCRAPE_DELAYS_MS = [900, 1500, 2200, 3000, 4200];

/**
 * Rough employment-type label from JSON-LD's SCREAMING_SNAKE_CASE enum.
 * Guards against non-string input on top of the array normalization in
 * JOB_SCRAPING_SCRIPT above — schema.org's employmentType is scraped from
 * arbitrary third-party job boards, so its shape can't be fully trusted even
 * with that normalization in place.
 */
function formatEmploymentType(raw: unknown): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Step 2 — the "magic import" screen. Loads the posting in a WebView kept
 * off-screen (not hidden from the user's understanding — a status line says
 * exactly what's happening) and auto-triggers the scrape once the page
 * settles, filling in a live JobPreviewCard field-by-field instead of
 * making the sponsor sit through a spinner or manually confirm a page.
 *
 * "Skip waiting" and "View original posting" are both one tap away, so a
 * sponsor never feels stuck behind the automation.
 */
export function CreateJobFetchingScreen({
  visible,
  url,
  onContinue,
  onBack,
  onClose,
}: CreateJobFetchingScreenProps) {
  const webviewRef = useRef<WebView>(null);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [scraped, setScraped] = useState<ScrapedJobData | null>(null);
  const [attempted, setAttempted] = useState(0);
  const [showRawView, setShowRawView] = useState(false);
  const [rawCanGoBack, setRawCanGoBack] = useState(false);
  const [rawCanGoForward, setRawCanGoForward] = useState(false);

  // Reset per-open so re-entering the screen with a new URL scrapes fresh.
  useEffect(() => {
    if (!visible) return;
    setPageLoaded(false);
    setScraped(null);
    setAttempted(0);
    setShowRawView(false);
  }, [visible, url]);

  // Auto-scrape once the page has settled. SPAs (Greenhouse/Lever/Workday
  // often render client-side) may not have their JobPosting JSON-LD in the
  // DOM the instant onLoadEnd fires. The old modal flow waited for the
  // sponsor to manually tap "Confirm" — often 5-15s after load — so the
  // automatic version has to be patient too: keep retrying on a backoff
  // schedule until the scrape finds a title/company signal, and only then
  // (or after the last attempt) accept the result. "Skip waiting" stays one
  // tap away the whole time.
  useEffect(() => {
    if (!visible || !pageLoaded || scraped) return;
    if (attempted >= SCRAPE_DELAYS_MS.length) return;
    const timer = setTimeout(() => {
      webviewRef.current?.injectJavaScript(JOB_SCRAPING_SCRIPT);
    }, SCRAPE_DELAYS_MS[attempted]);
    return () => clearTimeout(timer);
  }, [visible, pageLoaded, scraped, attempted]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== "JOB_CONTENT_SCRAPED") return;
      const payload = msg.data as ScrapedJobData;
      const hasSignal = !!(payload.structured?.title || payload.structured?.company);
      if (!hasSignal && attempted < SCRAPE_DELAYS_MS.length - 1) {
        // Came back empty — the retry effect above schedules the next pass.
        setAttempted((a) => a + 1);
        return;
      }
      setScraped(payload);
    } catch {
      // Non-JSON messages from the page itself — ignore.
    }
  };

  const previewFields: JobPreviewFields = {
    title: scraped?.structured?.title || "",
    company: scraped?.structured?.company || "",
    location: scraped?.structured?.location || "",
    salary: scraped?.structured?.salary || "",
    type: formatEmploymentType(scraped?.structured?.employmentType || null),
    logoUrl: null,
  };
  const stillReading = !scraped;
  const foundNothing = !!scraped && !scraped.structured;

  const finishWith = (data: ScrapedJobData | null) => {
    onContinue(
      data ?? {
        url,
        structured: null,
        rawText: "",
      },
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.screen}>
      {/* Header names the USER's job on this screen (review the extracted
          fields) — the transient machine action is narrated by the status
          line below, not the title. */}
      <CreateJobStepHeader
        title="Review the Posting"
        step={2}
        totalSteps={4}
        onBack={onBack}
        onClose={onClose}
      />

      <View style={styles.content}>
        <JobPreviewCard
          fields={previewFields}
          pending={{
            title: stillReading,
            company: stillReading,
            location: stillReading,
            salary: stillReading,
            type: stillReading,
          }}
        />

        <View style={styles.statusRow}>
          {stillReading ? (
            <>
              <Text style={styles.statusText}>
                Reading the posting — this takes a few seconds…
              </Text>
            </>
          ) : foundNothing ? (
            <Text style={styles.statusText}>
              Couldn&apos;t auto-read this page. No problem — you can fill in the
              details on the next screen.
            </Text>
          ) : (
            <Text style={styles.statusTextDone}>Got it — take a look ↓</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.rawLinkRow}
          onPress={() => setShowRawView(true)}
          activeOpacity={0.7}
        >
          <Eye size={14} color={Colors.muted} />
          <Text style={styles.rawLinkText}>View original posting</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        {stillReading ? (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => finishWith(scraped)}
            activeOpacity={0.7}
          >
            <Text style={styles.skipBtnText}>Skip waiting — I&apos;ll fill it in</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => finishWith(scraped)}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {foundNothing ? "Fill in details" : "Continue"}
            </Text>
            <ChevronRight color="#FFF" size={18} />
          </TouchableOpacity>
        )}
      </View>

      {/* The WebView never unmounts once created — toggling visibility
          keeps the page (and anything scraped) alive whether the sponsor
          is looking at the preview or the raw posting. While "hidden" it
          keeps a full-screen frame (invisible, non-interactive) rather than
          a 1x1 box: job boards that lazy-render based on viewport size
          never mount their content in a 1px viewport, which made scrapes
          come back empty. */}
      <View
        style={showRawView ? styles.rawViewContainer : styles.hiddenWebview}
        pointerEvents={showRawView ? "auto" : "none"}
      >
        {showRawView && (
          <SafeAreaView style={styles.rawViewSafeArea}>
            <View style={styles.rawViewHeader}>
              <TouchableOpacity
                onPress={() => setShowRawView(false)}
                style={styles.rawViewNavBtn}
                activeOpacity={0.7}
              >
                <ChevronLeft color="#000" size={22} />
              </TouchableOpacity>
              <View style={styles.rawViewUrlWrap}>
                <Globe color={Colors.muted} size={13} />
                <Text style={styles.rawViewUrlText} numberOfLines={1}>
                  {url}
                </Text>
              </View>
              <View style={styles.rawViewNavGroup}>
                <TouchableOpacity
                  onPress={() => webviewRef.current?.goBack()}
                  disabled={!rawCanGoBack}
                  style={styles.rawViewNavBtn}
                  activeOpacity={0.7}
                >
                  <ChevronLeft
                    color={rawCanGoBack ? "#000" : Colors.faint}
                    size={20}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => webviewRef.current?.goForward()}
                  disabled={!rawCanGoForward}
                  style={styles.rawViewNavBtn}
                  activeOpacity={0.7}
                >
                  <ChevronRight
                    color={rawCanGoForward ? "#000" : Colors.faint}
                    size={20}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        )}
        <WebView
          ref={webviewRef}
          source={{ uri: url }}
          style={styles.webview}
          onLoadEnd={() => setPageLoaded(true)}
          onNavigationStateChange={(nav) => {
            setRawCanGoBack(nav.canGoBack);
            setRawCanGoForward(nav.canGoForward);
          }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures={Platform.OS === "ios"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  statusRow: { marginTop: 20, alignItems: "center", paddingHorizontal: 8 },
  statusText: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  statusTextDone: {
    fontSize: 14,
    color: Colors.ink,
    fontWeight: "700",
    textAlign: "center",
  },
  rawLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
    paddingVertical: 8,
  },
  rawLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.muted,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  continueBtn: {
    flexDirection: "row",
    backgroundColor: Colors.ink,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueBtnText: { color: "#FFF", fontSize: 15.5, fontWeight: "700" },
  skipBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  // Quiet link — the house secondary voice (no underline).
  skipBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.muted,
  },
  hiddenWebview: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  webview: { flex: 1 },
  rawViewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFF",
  },
  rawViewSafeArea: { backgroundColor: "#FFF" },
  rawViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  rawViewNavBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: Colors.surface,
  },
  rawViewUrlWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rawViewUrlText: {
    flex: 1,
    fontSize: 12,
    color: Colors.body,
    fontWeight: "500",
  },
  rawViewNavGroup: { flexDirection: "row", alignItems: "center" },
});
