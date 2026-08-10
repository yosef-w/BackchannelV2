import { Image as ImageIcon, ThumbsDown, Trash2 } from "@/components/ui/icons";
import type { Job } from "@/types/jobs";
import { BlurView } from "expo-blur";
import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { CompanyLogo } from "../ui/CompanyLogo";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import { jobsModalStyles } from "./jobsModalStyles";
import { UNSPONSOR_REASONS } from "./jobTransforms";
import { Colors, Type } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface JobMenuModalProps {
  /** The job whose menu is open, or null when closed. */
  job: Job | null;
  /** Which tab the menu was opened from — sponsored jobs get the logo/
   * unsponsor options, browse jobs get "Not Interested". */
  activeTab: "browse" | "sponsored";
  // Unsponsor-reasons step
  showUnsponsorReasons: boolean;
  onShowUnsponsorReasons: () => void;
  unsponsorReason: string | null;
  onSetUnsponsorReason: (value: string) => void;
  unsponsorReasonDetail: string;
  onSetUnsponsorReasonDetail: (value: string) => void;
  onUnsponsor: (job: Job, reason: string, reasonDetail?: string) => void;
  // Logo-editor step
  showLogoEditor: boolean;
  onOpenLogoEditor: () => void;
  logoUrlInput: string;
  onSetLogoUrlInput: (value: string) => void;
  isSavingLogo: boolean;
  onSaveLogoUrl: () => void;
  onClose: () => void;
}

/**
 * Per-job menu sheet — root options (Replace Logo / Unsponsor for sponsored
 * jobs, Not Interested for browse jobs) plus its two sub-steps: the
 * unsponsor-reason picker (§12 backend pruning signal) and the PR #62 logo
 * override editor. Extracted from JobsView; all step state stays owned by
 * the caller so closeMenu can reset everything in one place.
 */
export function JobMenuModal({
  job,
  activeTab,
  showUnsponsorReasons,
  onShowUnsponsorReasons,
  unsponsorReason,
  onSetUnsponsorReason,
  unsponsorReasonDetail,
  onSetUnsponsorReasonDetail,
  onUnsponsor,
  showLogoEditor,
  onOpenLogoEditor,
  logoUrlInput,
  onSetLogoUrlInput,
  isSavingLogo,
  onSaveLogoUrl,
  onClose,
}: JobMenuModalProps) {
  return (
    <View style={jobsModalStyles.modalOverlay}>
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
        style={[
          jobsModalStyles.modalContent,
          // Absolute maxHeight — a "%" value resolves against the
          // gesture-root wrapper (which is content-sized), so the sheet
          // mis-measures and floats above the bottom. Absolute doesn't.
          { maxHeight: SCREEN_HEIGHT * 0.9 },
        ]}
      >
        {/* Job context — centered serif title + subtitle, the same
            decision-sheet language as the thread's menu. */}
        {job && !showLogoEditor && !showUnsponsorReasons && (
          <>
            <Text style={styles.menuSheetJobTitle} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={styles.menuSheetJobCompany} numberOfLines={1}>
              {job.company}
            </Text>
          </>
        )}

        {showLogoEditor ? (
          /* Step 2 — replace the company logo. PR #62 ships a
             sponsor-overridable `logo_url` on PATCH /api/jobs/<id>/edit/,
             useful when the Logo.dev resolver picked the wrong domain
             or doesn't know a boutique company. */
          <View style={{ flexShrink: 1, paddingBottom: 8 }}>
            <Text style={styles.unsponsorReasonHeading}>
              Replace Company Logo
            </Text>
            <Text style={styles.unsponsorReasonSub}>
              Paste a direct image URL (PNG, JPG, or SVG). Leave blank to keep
              the current logo.
            </Text>
            <View style={{ alignItems: "center", marginVertical: 16 }}>
              <CompanyLogo
                logoUrl={logoUrlInput.trim() || job?.image}
                name={job?.company}
                size={72}
                borderRadius={22}
                initialFontSize={32}
              />
            </View>
            <TextInput
              style={styles.reasonOtherInput}
              placeholder="https://example.com/logo.png"
              placeholderTextColor={Colors.faint}
              value={logoUrlInput}
              onChangeText={onSetLogoUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[
                styles.unsponsorConfirmBtn,
                (!logoUrlInput.trim() || isSavingLogo) && { opacity: 0.4 },
              ]}
              disabled={!logoUrlInput.trim() || isSavingLogo}
              onPress={onSaveLogoUrl}
              activeOpacity={0.8}
            >
              {isSavingLogo ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.unsponsorConfirmBtnText}>Save Logo</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : showUnsponsorReasons ? (
          /* Step 2 — capture WHY before removing the listing, so the
             backend can prune stale jobs (see §12 in
             docs/BACKEND_CHANGES_NEEDED.md). */
          <View style={{ flexShrink: 1, paddingBottom: 8 }}>
            <Text style={styles.unsponsorReasonHeading}>
              Why are you unsponsoring?
            </Text>
            <Text style={styles.unsponsorReasonSub}>
              This helps us keep job listings accurate and up to date.
            </Text>
            <SheetScrollView
              style={{ flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              {UNSPONSOR_REASONS.map((reason) => {
                const selected = unsponsorReason === reason.value;
                return (
                  <TouchableOpacity
                    key={reason.value}
                    style={styles.reasonRow}
                    onPress={() => onSetUnsponsorReason(reason.value)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        selected && styles.radioOuterActive,
                      ]}
                    >
                      {selected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.reasonLabel}>{reason.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {unsponsorReason === "other" && (
                <TextInput
                  style={styles.reasonOtherInput}
                  placeholder="Tell us more (optional)"
                  placeholderTextColor={Colors.faint}
                  value={unsponsorReasonDetail}
                  onChangeText={onSetUnsponsorReasonDetail}
                  multiline
                  autoCapitalize="sentences"
                />
              )}
            </SheetScrollView>
            <TouchableOpacity
              style={[
                styles.unsponsorConfirmBtn,
                !unsponsorReason && { opacity: 0.4 },
              ]}
              disabled={!unsponsorReason}
              onPress={() =>
                job &&
                unsponsorReason &&
                onUnsponsor(job, unsponsorReason, unsponsorReasonDetail)
              }
              activeOpacity={0.8}
            >
              <Text style={styles.unsponsorConfirmBtnText}>
                Unsponsor Job
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingBottom: 8 }}>
            {activeTab === "sponsored" && job ? (
              <>
                <TouchableOpacity
                  style={styles.actionOutlineBtn}
                  onPress={onOpenLogoEditor}
                  activeOpacity={0.7}
                >
                  <ImageIcon size={18} color={Colors.ink} strokeWidth={2} />
                  <Text style={styles.actionOutlineText}>Replace Logo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionPrimaryBtn}
                  onPress={onShowUnsponsorReasons}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color="#FFF" strokeWidth={2} />
                  <Text style={styles.actionPrimaryText}>Unsponsor Job</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.actionPrimaryBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <ThumbsDown size={18} color="#FFF" strokeWidth={2} />
                <Text style={styles.actionPrimaryText}>Not Interested</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionCancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </DismissibleSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centered decision-sheet header — matches ThreadMenuSheet.
  menuSheetJobTitle: {
    fontFamily: Type.heading.fontFamily,
    fontSize: 20,
    color: Colors.ink,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  menuSheetJobCompany: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 24,
  },
  // Stacked full-width actions — the thread menu's exact vocabulary:
  // outlined secondary, ink primary, hairline cancel.
  actionOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    marginBottom: 12,
  },
  actionOutlineText: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  actionPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.ink,
    marginBottom: 12,
  },
  actionPrimaryText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  actionCancelBtn: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCancelText: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  unsponsorReasonHeading: {
    textAlign: "center",
    fontFamily: Type.heading.fontFamily,
    fontSize: 18,
    color: Colors.ink,
    marginBottom: 4,
  },
  unsponsorReasonSub: {
    textAlign: "center",
    fontSize: 13,
    color: Colors.body,
    fontWeight: "500",
    marginBottom: 10,
  },
  reasonOtherInput: {
    marginTop: 14,
    backgroundColor: Colors.offWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 14,
    color: "#000",
    minHeight: 72,
    textAlignVertical: "top",
  },
  unsponsorConfirmBtn: {
    marginTop: 16,
    backgroundColor: Colors.ink,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  unsponsorConfirmBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: "#000" },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#000",
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
});
