import { MessageCircle } from "@/components/ui/icons";
import {
    getPublicProfile,
    type PublicProfileResponse,
} from "@/lib/api";
import { useToastStore } from "@/stores/useToastStore";
import { BlurView } from "expo-blur";
import React, { useEffect, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import {
    BarFooter,
    canvasSheet,
    PacketCard,
    PersonHero,
    QuietAction,
    RoleTicket,
    SectionCard,
    SkeletonCard,
    Timeline,
    type PacketField,
} from "./JobSheetKit";
import { Referral } from "./matchesQueries";
import { modalStyles } from "./sharedModalStyles";
import { Colors } from "@/constants/theme";

interface SponsorReferralDetailModalProps {
  /** The submitted referral being viewed, or null when closed. */
  referral: Referral | null;
  onClose: () => void;
  /** Message the referred applicant (jobId, applicantUserId). */
  onMessage?: (jobId: string, userId: string) => void;
  /** Open the withdraw confirmation for this referral. */
  onWithdraw: (referral: Referral) => void;
}

/**
 * Sponsor-side referral detail — the permanent home of the referral
 * packet. The flow's receipt shows it once; this sheet (Matches →
 * Referrals → tap a row) holds it forever, so a sponsor can enter the
 * applicant into their company's ATS portal whenever they get around
 * to it. Applicant details are fetched fresh from the public profile.
 */
export function SponsorReferralDetailModal({
  referral,
  onClose,
  onMessage,
  onWithdraw,
}: SponsorReferralDetailModalProps) {
  const showToast = useToastStore((s) => s.showToast);
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // Guards a slow fetch from landing on a different referral's sheet.
  const activeReferralId = useRef<string | null>(null);

  useEffect(() => {
    activeReferralId.current = referral?.referralId ?? null;
    setProfile(null);
    if (!referral?.applicantUserId) {
      setLoading(false);
      return;
    }
    const rid = referral.referralId;
    setLoading(true);
    getPublicProfile(String(referral.applicantUserId))
      .then((p) => {
        if (activeReferralId.current === rid) setProfile(p);
      })
      .catch((err) =>
        console.warn(
          "[SponsorReferralDetail] Failed to fetch applicant profile:",
          err,
        ),
      )
      .finally(() => {
        if (activeReferralId.current === rid) setLoading(false);
      });
  }, [referral]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={modalStyles.modalOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet
        scrollDismiss
        onDismiss={onClose}
        style={[modalStyles.modalContent, canvasSheet]}
      >
        {referral &&
          (() => {
            const r = referral;
            const isReferred = r.status === "REFERRED";
            const name =
              [r.applicantFirstName, r.applicantLastName]
                .filter(Boolean)
                .join(" ") ||
              (profile
                ? `${profile.FIRST_NAME || ""} ${profile.LAST_NAME || ""}`.trim()
                : "Applicant");
            const firstName = name.split(" ")[0];
            const currentRole =
              profile?.applicant_profile?.CURRENT_ROLE || "";
            const location = [profile?.CITY, profile?.STATE]
              .filter(Boolean)
              .join(", ");
            const industry = profile?.applicant_profile?.INDUSTRY || "";
            const yearsExp = profile?.applicant_profile?.YEARS_EXPERIENCE;
            const referredDate = r.createdAt
              ? new Date(r.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : undefined;

            const packetFields: PacketField[] = [
              { label: "Name", value: name },
              // §Q — sponsor-only; PacketCard drops empty rows, so this
              // stays invisible until the backend value is present.
              { label: "Email", value: r.applicantEmail || "" },
              { label: "Role", value: currentRole },
              { label: "Location", value: location },
              { label: "Industry", value: industry },
              {
                label: "Experience",
                value: yearsExp ? `${yearsExp} years` : "",
              },
              { label: "Portfolio", value: profile?.PORTFOLIO_URL || "" },
              {
                label: "Referred for",
                value: [r.jobTitle, r.jobCompany].filter(Boolean).join(" at "),
              },
            ];

            return (
              <>
                <SheetScrollView
                  style={styles.scroll}
                  contentContainerStyle={{ paddingBottom: 16 }}
                >
                  <PersonHero
                    name={name}
                    image={r.applicantPhotoUrl || profile?.PHOTO_URL || undefined}
                    meta={currentRole || undefined}
                    location={location || undefined}
                    pill={
                      isReferred
                        ? { label: "Referred" }
                        : {
                            label: "Withdrawn",
                            color: Colors.body,
                            bgColor: "#F0F2F7",
                          }
                    }
                    onClose={onClose}
                  />

                  {!!(r.jobTitle || r.jobCompany) && (
                    <RoleTicket
                      label="Referred for"
                      title={r.jobTitle || "A role"}
                      company={r.jobCompany || undefined}
                      logoUrl={r.jobLogoUrl}
                    />
                  )}

                  {isReferred && (
                    <Timeline
                      steps={[
                        {
                          label: "Referred",
                          sub: referredDate,
                          state: "done",
                        },
                        {
                          label: "Hiring team review",
                          sub: "In progress",
                          state: "active",
                        },
                      ]}
                    />
                  )}

                  {loading && !profile ? (
                    <SkeletonCard title="Referral Packet" />
                  ) : (
                    <PacketCard
                      fields={packetFields}
                      onCopied={(what) =>
                        showToast(`${what} copied.`, "success")
                      }
                    />
                  )}

                  {!!r.referralNote && (
                    <SectionCard title="Your Note">
                      <Text style={styles.noteText}>
                        &ldquo;{r.referralNote}&rdquo;
                      </Text>
                    </SectionCard>
                  )}
                </SheetScrollView>

                <BarFooter
                  context={
                    referredDate
                      ? {
                          title: isReferred
                            ? `Referred ${referredDate}`
                            : "Withdrawn",
                          done: isReferred,
                        }
                      : undefined
                  }
                  button={
                    onMessage && r.jobId && r.applicantUserId
                      ? {
                          label: "Message",
                          icon: (
                            <MessageCircle
                              color="#FFF"
                              size={17}
                              strokeWidth={2.5}
                            />
                          ),
                          onPress: () => {
                            onClose();
                            onMessage(r.jobId, r.applicantUserId);
                          },
                        }
                      : { label: "Done", onPress: onClose }
                  }
                >
                  {isReferred && (
                    <QuietAction
                      label={`Withdraw ${firstName}'s referral`}
                      destructive
                      onPress={() => {
                        onClose();
                        onWithdraw(r);
                      }}
                    />
                  )}
                </BarFooter>
              </>
            );
          })()}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Shrinks below its content height when the sheet hits its maxHeight cap,
  // leaving room for the pinned action bar; scrolls the overflow.
  scroll: { flexShrink: 1 },
  noteText: {
    fontSize: 14,
    fontStyle: "italic",
    fontWeight: "500",
    color: "#374151",
    lineHeight: 21,
  },
});
