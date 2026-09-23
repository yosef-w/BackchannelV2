import { ChevronRight, MessageCircle } from "@/components/ui/icons";
import React from "react";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { BlurView } from "expo-blur";
import { CompanyLogo } from "../ui/CompanyLogo";
import {
    DismissibleSheet,
    SheetScrollView,
} from "../ui/DismissibleSheet";
import { canvasSheet, SheetCloseButton } from "./JobSheetKit";
import { Match } from "./matchesQueries";
import { Colors, Radii, Type } from "@/constants/theme";
import { sheetMaxHeight } from "@/lib/responsive";

export interface RoleGroup {
  items: Match[];
  getMessageUserId: (m: Match) => string | undefined;
}

interface RolePickerModalProps {
  /** The grouped match card that was tapped, or null when closed. */
  roleGroup: RoleGroup | null;
  onClose: () => void;
  /** View this specific role's matched profile. */
  onSelectRole: (match: Match) => void;
  /** Message this specific role's counterpart. */
  onMessageRole: (match: Match) => void;
}

/**
 * Role picker — shown when a grouped match card (same person, multiple
 * roles) is tapped. Lets the user choose which role to view or message so
 * neither action silently defaults to the most-recent match.
 */
export function RolePickerModal({
  roleGroup,
  onClose,
  onSelectRole,
  onMessageRole,
}: RolePickerModalProps) {
  const { height } = useWindowDimensions();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.modalOverlay}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet
        scrollDismiss
        onDismiss={onClose}
        style={[
          styles.modalContent,
          canvasSheet,
          { maxHeight: sheetMaxHeight(height, 0.88) },
        ]}
      >
        {roleGroup && (
          <>
            <SheetCloseButton onPress={onClose} />
            <View style={[styles.rolePickerHeader, { paddingRight: 36 }]}>
              {roleGroup.items[0].image ? (
                <Image
                  source={{ uri: roleGroup.items[0].image }}
                  style={styles.rolePickerAvatar}
                />
              ) : (
                <View
                  style={[
                    styles.rolePickerAvatar,
                    {
                      backgroundColor: Colors.ink,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                      color: Colors.paper,
                    }}
                  >
                    {(roleGroup.items[0].name || "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.rolePickerName} numberOfLines={1}>
                  {roleGroup.items[0].name}
                </Text>
                <Text style={styles.rolePickerSub}>
                  Matched on {roleGroup.items.length} roles — pick one to view
                  or message
                </Text>
              </View>
            </View>

            <SheetScrollView style={{ marginTop: 8 }}>
              {roleGroup.items.map((m) => (
                <View key={m.id} style={styles.rolePickerRow}>
                  <TouchableOpacity
                    style={styles.rolePickerRowMain}
                    activeOpacity={0.7}
                    onPress={() => onSelectRole(m)}
                  >
                    <CompanyLogo
                      logoUrl={m.companyLogoUrl}
                      name={m.company || m.appliedRole}
                      size={44}
                      borderRadius={14}
                      initialFontSize={18}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.rolePickerRole} numberOfLines={1}>
                        {m.appliedRole || "Role"}
                      </Text>
                      <Text style={styles.rolePickerMeta} numberOfLines={1}>
                        {[m.company, m.date && `Matched ${m.date}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    <ChevronRight color={Colors.faint} size={18} strokeWidth={2.2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rolePickerMsgBtn}
                    activeOpacity={0.8}
                    onPress={() => onMessageRole(m)}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${m.name}`}
                  >
                    <MessageCircle color={Colors.paper} size={16} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              ))}
            </SheetScrollView>
          </>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    // Gripper hugs the sheet edge (PM: it floated too far down) —
    // 12 matches the sheets that already looked right.
    paddingTop: 12,
    paddingHorizontal: 28,
    paddingBottom: 40,
    // maxHeight (sheet sizes to its content; only grows to fill/scroll past
    // this cap) is applied inline above via sheetMaxHeight(), computed from
    // the live useWindowDimensions() height — not a frozen Dimensions.get
    // snapshot, so it stays correct across rotation / Split View / Stage
    // Manager resize.
  },
  rolePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  rolePickerAvatar: { width: 52, height: 52, borderRadius: 26 },
  rolePickerName: { fontFamily: Type.heading.fontFamily, fontSize: 20, color: Colors.ink },
  rolePickerSub: {
    fontSize: 13,
    color: Colors.body,
    marginTop: 3,
    lineHeight: 18,
  },
  // Flat, bordered row — the same "Docket" ticket language JobSheetKit's
  // RoleTicket uses elsewhere, not a floating drop-shadow card (the
  // rebrand retired shadows on sheet content; this was the one leftover).
  rolePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 10,
    backgroundColor: Colors.paper,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rolePickerRowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rolePickerRole: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  rolePickerMeta: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  rolePickerMsgBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
});
