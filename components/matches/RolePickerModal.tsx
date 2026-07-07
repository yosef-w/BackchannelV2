import { MessageCircle } from "@/components/ui/icons";
import React from "react";
import {
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { BlurView } from "expo-blur";
import { CompanyLogo } from "../ui/CompanyLogo";
import { DismissibleSheet } from "../ui/DismissibleSheet";
import { Match } from "./matchesQueries";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>

      <DismissibleSheet onDismiss={onClose} style={styles.modalContent}>
        {roleGroup && (
          <>
            <View style={styles.rolePickerHeader}>
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
                      backgroundColor: "#000",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                      color: "#FFF",
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

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={{ marginTop: 8 }}
            >
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
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rolePickerMsgBtn}
                    activeOpacity={0.8}
                    onPress={() => onMessageRole(m)}
                  >
                    <MessageCircle color="#FFF" size={16} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </DismissibleSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 28,
    paddingBottom: 40,
    // Sheet sizes to its content; only grows to fill (and scroll) when the
    // content is taller than this cap — no empty whitespace for short modals.
    // Absolute px (not "88%") so it doesn't depend on a parent with a fixed
    // height — the GestureHandlerRootView wrapper inside DismissibleSheet is
    // content-sized, and a % maxHeight against it would collapse to nothing.
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  rolePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  rolePickerAvatar: { width: 52, height: 52, borderRadius: 26 },
  rolePickerName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  rolePickerSub: {
    fontSize: 13,
    color: "#666",
    marginTop: 3,
    lineHeight: 18,
  },
  rolePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F2",
  },
  rolePickerRowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rolePickerRole: { fontSize: 15, fontWeight: "700", color: "#000" },
  rolePickerMeta: { fontSize: 13, color: "#999", marginTop: 2 },
  rolePickerMsgBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
});
