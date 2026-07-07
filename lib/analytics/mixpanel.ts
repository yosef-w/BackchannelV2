/**
 * Mixpanel analytics — single entry point for the entire app.
 *
 * Rules of the road:
 *  - NEVER call `mixpanel.track(...)` directly anywhere else in the codebase.
 *    Always go through one of the typed helpers exported below. New events
 *    get a new helper here.
 *  - All helpers are fire-and-forget: every call is wrapped in try/catch and
 *    a no-op until init succeeds, so analytics failures NEVER break the app.
 *  - Every event automatically picks up `user_type` (applicant / sponsor /
 *    unknown) so charts in Mixpanel can be filtered by user segment without
 *    callers having to remember to pass it.
 *  - Properties are typed via the helper signatures — when adding a new
 *    property to an event, update the helper's argument type.
 *
 * 🔑  Replace the placeholder token on the line marked `// TOKEN` below.
 *     Better: move it to a `MIXPANEL_TOKEN` env var (see notes at end of file).
 */

import { Mixpanel } from "mixpanel-react-native";
import { clearSentryUser, setSentryUser } from "../sentry";

// ─── Setup ────────────────────────────────────────────────────────────────────

// TOKEN — loaded from the environment so it never has to be committed to git.
// Set EXPO_PUBLIC_MIXPANEL_TOKEN in your .env.development / .env.test /
// .env.production file (copy .env.example to get started).
const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? "";

// `trackAutomaticEvents = false` — we drive every event explicitly. Mixpanel's
// automatic events (App Open, Session, etc.) overlap with our own taxonomy and
// add noise without value.
//
// The constructor is guarded against a missing/empty token because the native
// Mixpanel iOS SDK throws NSInvalidArgumentException when handed one, which
// surfaces as a TurboModule crash at app launch (the JS bundle evaluates this
// file before any UI mounts). When the token is missing every helper below
// short-circuits via the `initialized` guard, so analytics simply no-ops.
const mixpanel: Mixpanel | null = MIXPANEL_TOKEN
  ? new Mixpanel(MIXPANEL_TOKEN, false)
  : null;

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialise the Mixpanel client. Idempotent — safe to call multiple times.
 * Should be invoked once on app start (see `app/_layout.tsx`).
 */
export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  if (!mixpanel) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await mixpanel.init();
      initialized = true;
    } catch (err) {
      // Init failures shouldn't break the app — analytics will simply no-op.
      // eslint-disable-next-line no-console
      console.warn("[Analytics] init failed:", err);
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
}

// ─── Identity ─────────────────────────────────────────────────────────────────

export type AnalyticsUserType = "applicant" | "sponsor" | "unknown";

let currentUserType: AnalyticsUserType = "unknown";

interface IdentifyArgs {
  userId: string;
  userType: AnalyticsUserType;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Sponsor-only — claimed company name. */
  company?: string | null;
  /** Sponsor-only — claimed job title. */
  jobTitle?: string | null;
  /** Sponsor-only — has the work email been verified by the backend? */
  workEmailVerified?: boolean;
  /** Account email verified flag (PR #38). */
  emailVerified?: boolean;
  /** Where the user lives (city / state, freeform). */
  location?: string | null;
  /** Applicant-only — current role / job title. */
  currentRole?: string | null;
}

/**
 * Identify the logged-in user against Mixpanel and stamp their profile
 * attributes onto the People record. Called right after any successful
 * login / signup. Fire-and-forget.
 */
export async function identifyUser(args: IdentifyArgs): Promise<void> {
  currentUserType = args.userType;
  // Mirror identity into Sentry (id-only) so a crash report can always be
  // matched to the account that hit it. Kept here — rather than at each
  // login/signup call site — so the two systems can't drift apart.
  try {
    setSentryUser(args.userId);
  } catch {
    // Sentry identity is best-effort, never blocks analytics.
  }
  if (!initialized) await initAnalytics();
  if (!initialized || !mixpanel) return;
  try {
    await mixpanel.identify(args.userId);
    const props: Record<string, any> = {
      $email: args.email ?? undefined,
      $first_name: args.firstName ?? undefined,
      $last_name: args.lastName ?? undefined,
      $name:
        [args.firstName, args.lastName].filter(Boolean).join(" ") || undefined,
      user_id: args.userId,
      user_type: args.userType,
      email_verified: args.emailVerified ?? undefined,
      work_email_verified: args.workEmailVerified ?? undefined,
      company: args.company ?? undefined,
      job_title: args.jobTitle ?? undefined,
      location: args.location ?? undefined,
      current_role: args.currentRole ?? undefined,
    };
    // Strip undefined values — Mixpanel persists nulls but ignores undefineds
    // unevenly across SDK versions, so we filter for predictability.
    const cleaned = Object.fromEntries(
      Object.entries(props).filter(([, v]) => v !== undefined),
    );
    mixpanel.getPeople().set(cleaned);
    // Also register super-properties so every subsequent track() call carries
    // user_type without callers having to thread it through.
    mixpanel.registerSuperProperties({
      user_type: args.userType,
      user_id: args.userId,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Analytics] identify failed:", err);
  }
}

/**
 * Clear the identity association. Call on logout. Fire-and-forget.
 */
export async function resetUser(): Promise<void> {
  currentUserType = "unknown";
  // Paired with the setSentryUser() in identifyUser — crashes after logout /
  // account deletion must not be attributed to the previous account.
  try {
    clearSentryUser();
  } catch {
    // Best-effort, never blocks the logout path.
  }
  if (!initialized || !mixpanel) return;
  try {
    await mixpanel.reset();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Analytics] reset failed:", err);
  }
}

/**
 * Update one or more People-record fields outside of an explicit identify call
 * (e.g. when a user edits their profile). Silent on failure.
 */
export function setUserProperties(
  props: Partial<Omit<IdentifyArgs, "userId">>,
): void {
  if (!initialized || !mixpanel) return;
  try {
    if (props.userType) {
      currentUserType = props.userType;
      mixpanel.registerSuperProperties({ user_type: props.userType });
    }
    const peopleProps: Record<string, any> = {
      $email: props.email ?? undefined,
      $first_name: props.firstName ?? undefined,
      $last_name: props.lastName ?? undefined,
      email_verified: props.emailVerified ?? undefined,
      work_email_verified: props.workEmailVerified ?? undefined,
      company: props.company ?? undefined,
      job_title: props.jobTitle ?? undefined,
      location: props.location ?? undefined,
      current_role: props.currentRole ?? undefined,
    };
    const cleaned = Object.fromEntries(
      Object.entries(peopleProps).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(cleaned).length > 0) mixpanel.getPeople().set(cleaned);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Analytics] setUserProperties failed:", err);
  }
}

// ─── Internal track wrapper ───────────────────────────────────────────────────

type EventProps = Record<string, string | number | boolean | null | undefined>;

function safeTrack(event: string, properties?: EventProps): void {
  if (!initialized || !mixpanel) return;
  try {
    const cleaned: Record<string, string | number | boolean | null> = {
      user_type: currentUserType,
    };
    if (properties) {
      for (const [k, v] of Object.entries(properties)) {
        if (v !== undefined) cleaned[k] = v;
      }
    }
    mixpanel.track(event, cleaned);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[Analytics] track("${event}") failed:`, err);
  }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

export function trackAppOpened(): void {
  safeTrack("App Opened");
}

// ─── Screen views (fired from MainApp on every view change) ───────────────────

export function trackScreenViewed(
  screenName: string,
  extra?: EventProps,
): void {
  safeTrack("Screen Viewed", { screen_name: screenName, ...extra });
}

// ─── First-run Home intro overlay ─────────────────────────────────────────────

export function trackHomeIntroShown(trigger: "first_time" | "replay"): void {
  safeTrack("Home Intro Shown", { trigger });
}

export function trackHomeIntroDismissed(action: "complete" | "skip"): void {
  safeTrack("Home Intro Dismissed", { action });
}

// ─── Auth & onboarding ────────────────────────────────────────────────────────

export function trackSignUpRoleSelected(role: AnalyticsUserType): void {
  safeTrack("Sign Up Role Selected", { selected_role: role });
}

export function trackSignUpFormSubmitted(role: AnalyticsUserType): void {
  safeTrack("Sign Up Form Submitted", { selected_role: role });
}

export function trackSignUpSucceeded(role: AnalyticsUserType): void {
  safeTrack("Sign Up Succeeded", { selected_role: role });
}

export function trackSignUpFailed(
  role: AnalyticsUserType,
  reason: string,
): void {
  safeTrack("Sign Up Failed", { selected_role: role, reason });
}

export function trackLoginSubmitted(): void {
  safeTrack("Login Submitted");
}

export function trackLoginSucceeded(role: AnalyticsUserType): void {
  safeTrack("Login Succeeded", { logged_in_as: role });
}

export function trackLoginFailed(reason: string): void {
  safeTrack("Login Failed", { reason });
}

export function trackLogout(): void {
  safeTrack("Logout");
}

export function trackForgotPasswordRequested(): void {
  safeTrack("Forgot Password Requested");
}

export function trackOnboardingStepViewed(args: {
  role: AnalyticsUserType;
  stepIndex: number;
  stepName?: string;
}): void {
  safeTrack("Onboarding Step Viewed", {
    onboarding_role: args.role,
    step_index: args.stepIndex,
    step_name: args.stepName,
  });
}

export function trackOnboardingCompleted(role: AnalyticsUserType): void {
  safeTrack("Onboarding Completed", { onboarding_role: role });
}

export function trackResumeUploaded(args: {
  source: "questionnaire" | "profile";
  fileSizeBytes?: number;
}): void {
  safeTrack("Resume Uploaded", {
    upload_source: args.source,
    file_size_bytes: args.fileSizeBytes,
  });
}

// ─── Email verification ───────────────────────────────────────────────────────

export function trackVerifyEmailOpened(args: { hasToken: boolean }): void {
  safeTrack("Verify Email Opened", { has_token: args.hasToken });
}

export function trackVerifyEmailSucceeded(args: {
  alreadyVerified: boolean;
}): void {
  safeTrack("Verify Email Succeeded", {
    already_verified: args.alreadyVerified,
  });
}

export function trackVerifyEmailFailed(reason: string): void {
  safeTrack("Verify Email Failed", { reason });
}

export function trackResendVerificationRequested(args: {
  source: "verify_email_screen" | "settings";
}): void {
  safeTrack("Resend Verification Requested", { request_source: args.source });
}

// Work-email verification (sponsors) — the swipe gate that most commonly
// stalls sponsor activation, so each affordance in the modal gets its own
// event to see WHERE stuck sponsors go: resend, fix the address, or confirm.

export function trackWorkEmailResendRequested(): void {
  safeTrack("Work Email Resend Requested");
}

/** Sponsor corrected their work email in the modal ("Save & resend"). */
export function trackWorkEmailUpdated(): void {
  safeTrack("Work Email Updated");
}

/** "I've Verified My Email" pressed — outcome says if the backend agreed. */
export function trackWorkEmailVerifyChecked(args: { verified: boolean }): void {
  safeTrack("Work Email Verify Checked", { verified: args.verified });
}

export function trackResetPasswordOpened(args: { hasToken: boolean }): void {
  safeTrack("Reset Password Opened", { has_token: args.hasToken });
}

export function trackResetPasswordSucceeded(): void {
  safeTrack("Reset Password Succeeded");
}

export function trackResetPasswordFailed(reason: string): void {
  safeTrack("Reset Password Failed", { reason });
}

// ─── Feed: applicant (jobs deck) ──────────────────────────────────────────────

export function trackJobCardViewed(args: {
  jobId: string;
  isSponsored: boolean;
}): void {
  safeTrack("Job Card Viewed", {
    job_id: args.jobId,
    is_sponsored: args.isSponsored,
  });
}

export function trackJobLiked(args: {
  jobId: string;
  isSponsored: boolean;
  matched: boolean;
}): void {
  safeTrack("Job Liked", {
    job_id: args.jobId,
    is_sponsored: args.isSponsored,
    matched: args.matched,
  });
}

export function trackJobSkipped(args: {
  jobId: string;
  isSponsored: boolean;
}): void {
  safeTrack("Job Skipped", {
    job_id: args.jobId,
    is_sponsored: args.isSponsored,
  });
}

export function trackJobWaitlistJoined(args: { jobId: string }): void {
  safeTrack("Job Waitlist Joined", { job_id: args.jobId });
}

export function trackSponsorRequested(args: { jobId: string }): void {
  safeTrack("Sponsor Requested", { job_id: args.jobId });
}

// ─── Feed: sponsor (applicants deck) ──────────────────────────────────────────

export function trackProfileCardViewed(args: {
  applicantUserId: string;
  jobId?: string;
}): void {
  safeTrack("Profile Card Viewed", {
    applicant_user_id: args.applicantUserId,
    job_id: args.jobId,
  });
}

export function trackProfileLiked(args: {
  applicantUserId: string;
  jobId?: string;
  matched: boolean;
}): void {
  safeTrack("Profile Liked", {
    applicant_user_id: args.applicantUserId,
    job_id: args.jobId,
    matched: args.matched,
  });
}

export function trackProfileSkipped(args: {
  applicantUserId: string;
  jobId?: string;
}): void {
  safeTrack("Profile Skipped", {
    applicant_user_id: args.applicantUserId,
    job_id: args.jobId,
  });
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export function trackMatchCreated(args: {
  matchedWithName?: string;
  jobId?: string;
  origin: "applicant_swipe" | "sponsor_swipe";
}): void {
  safeTrack("Match Created", {
    matched_with_name: args.matchedWithName,
    job_id: args.jobId,
    match_origin: args.origin,
  });
}

export function trackMatchMessageTapped(args: { jobId?: string }): void {
  safeTrack("Match Message Tapped", { job_id: args.jobId });
}

export function trackSponsorLikedBack(args: { likeId: string }): void {
  safeTrack("Sponsor Liked Back", { like_id: args.likeId });
}

export function trackApplicantLikedBack(args: {
  applicantUserId: string;
  jobId: string;
}): void {
  safeTrack("Applicant Liked Back", {
    applicant_user_id: args.applicantUserId,
    job_id: args.jobId,
  });
}

export function trackReferralWithdrawn(args: { referralId: string }): void {
  safeTrack("Referral Withdrawn", { referral_id: args.referralId });
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export function trackConversationOpened(args: {
  conversationId: string;
  unreadCount?: number;
}): void {
  safeTrack("Conversation Opened", {
    conversation_id: args.conversationId,
    unread_count: args.unreadCount,
  });
}

export function trackMessageSent(args: {
  conversationId: string;
  messageLength: number;
}): void {
  safeTrack("Message Sent", {
    conversation_id: args.conversationId,
    message_length: args.messageLength,
  });
}

export function trackPublicProfileOpenedFromMessage(args: {
  viewedUserId: string;
}): void {
  safeTrack("Public Profile Opened From Message", {
    viewed_user_id: args.viewedUserId,
  });
}

export function trackUnmatchConfirmed(args: { conversationId: string }): void {
  safeTrack("Unmatch Confirmed", { conversation_id: args.conversationId });
}

/**
 * A report was filed against another user (which also blocks them). Safety
 * signal worth watching per-reason — a spike in "harassment" is a different
 * problem than a spike in "fake_profile".
 */
export function trackUserReported(args: {
  reason: string;
  fromConversation: boolean;
}): void {
  safeTrack("User Reported", {
    report_reason: args.reason,
    from_conversation: args.fromConversation,
  });
}

export function trackReferralSubmitted(args: {
  conversationId: string;
  jobId?: string;
  applicantUserId?: string;
}): void {
  safeTrack("Referral Submitted", {
    conversation_id: args.conversationId,
    job_id: args.jobId,
    applicant_user_id: args.applicantUserId,
  });
}

// ─── Sponsor jobs ─────────────────────────────────────────────────────────────

export function trackBrowseJobsViewed(): void {
  safeTrack("Browse Jobs Viewed");
}

export function trackJobSponsorStarted(args: { silverJobId: string }): void {
  safeTrack("Job Sponsor Started", { silver_job_id: args.silverJobId });
}

export function trackJobSponsored(args: {
  silverJobId: string;
  newJobId: string;
  relationship: string;
  canRefer: boolean;
  insightsCount: number;
}): void {
  safeTrack("Job Sponsored", {
    silver_job_id: args.silverJobId,
    new_job_id: args.newJobId,
    sponsor_relationship: args.relationship,
    can_refer: args.canRefer,
    insights_filled_count: args.insightsCount,
  });
}

export function trackJobUnsponsored(args: {
  jobId: string;
  reason?: string;
}): void {
  safeTrack("Job Unsponsored", {
    job_id: args.jobId,
    ...(args.reason ? { reason: args.reason } : {}),
  });
}

export function trackJobCreateFromUrlStarted(): void {
  safeTrack("Job Create From URL Started");
}

export function trackJobCreatedFromUrl(args: {
  jobId: string;
  source: "structured" | "llm" | "unknown";
  hasInsights: boolean;
}): void {
  safeTrack("Job Created From URL", {
    job_id: args.jobId,
    extraction_source: args.source,
    has_insights: args.hasInsights,
  });
}

export function trackJobCreateFromUrlFailed(args: {
  reason: string;
  rateLimited: boolean;
}): void {
  safeTrack("Job Create From URL Failed", {
    reason: args.reason,
    rate_limited: args.rateLimited,
  });
}

// ─── Check-ins (PR #37) ───────────────────────────────────────────────────────

export function trackCheckInModalOpened(args: {
  role: AnalyticsUserType;
  referralCount: number;
}): void {
  safeTrack("Check In Modal Opened", {
    role: args.role,
    referral_count: args.referralCount,
  });
}

export function trackApplicantCheckInSubmitted(args: {
  referralId: string;
  stage: string;
  hasNote: boolean;
}): void {
  safeTrack("Applicant Check In Submitted", {
    referral_id: args.referralId,
    stage: args.stage,
    has_note: args.hasNote,
  });
}

export function trackSponsorBatchCheckInSubmitted(args: {
  updateCount: number;
}): void {
  safeTrack("Sponsor Batch Check In Submitted", {
    update_count: args.updateCount,
  });
}

export function trackCheckInFailed(args: {
  role: AnalyticsUserType;
  reason: string;
}): void {
  safeTrack("Check In Failed", { role: args.role, reason: args.reason });
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function trackProfileEditOpened(args: { section: string }): void {
  safeTrack("Profile Edit Opened", { profile_section: args.section });
}

export function trackProfileFieldUpdated(args: { field: string }): void {
  safeTrack("Profile Field Updated", { profile_field: args.field });
}

export function trackProfilePhotoUploaded(args: {
  source: "camera" | "library";
}): void {
  safeTrack("Profile Photo Uploaded", { upload_source: args.source });
}

export function trackResumeReuploaded(): void {
  safeTrack("Resume Reuploaded");
}

export function trackAccountDeleted(): void {
  safeTrack("Account Deleted");
}

/** Change-email confirmation link sent (the change isn't live until the
 * link is opened, so this is "requested", not "changed"). */
export function trackChangeEmailRequested(): void {
  safeTrack("Change Email Requested");
}

export function trackPasswordChanged(): void {
  safeTrack("Password Changed");
}

export function trackPrivacyPolicyTapped(): void {
  safeTrack("Privacy Policy Tapped");
}

export function trackTermsTapped(): void {
  safeTrack("Terms Tapped");
}

export function trackTesterModeEnabled(args: {
  source: "profile_completion_modal" | "email_verification_modal";
}): void {
  safeTrack("Tester Mode Enabled", { entry_point: args.source });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function trackNotificationTapped(args: {
  notificationId: string;
  notificationType?: string;
}): void {
  safeTrack("Notification Tapped", {
    notification_id: args.notificationId,
    notification_type: args.notificationType,
  });
}

export function trackNotificationMarkedRead(args: {
  notificationId: string;
}): void {
  safeTrack("Notification Marked Read", {
    notification_id: args.notificationId,
  });
}

export function trackAllNotificationsMarkedRead(args: { count: number }): void {
  safeTrack("All Notifications Marked Read", { marked_read_count: args.count });
}

export function trackPushNotificationTapped(args: { pushType?: string }): void {
  safeTrack("Push Notification Tapped", { push_type: args.pushType });
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export function trackApiError(args: {
  endpoint: string;
  statusOrReason: string;
}): void {
  safeTrack("API Error", {
    endpoint: args.endpoint,
    status_or_reason: args.statusOrReason,
  });
}

// ─── Default export ───────────────────────────────────────────────────────────

export default mixpanel;
