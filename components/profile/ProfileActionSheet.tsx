import { X } from "@/components/ui/icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { DismissibleSheet } from "@/components/ui/DismissibleSheet";
import { Colors, Fonts, Radii, Type } from "@/constants/theme";
import { hitSlopTo44, sheetColumn, sheetMaxHeight } from "@/lib/responsive";

interface ProfileActionSheetProps {
  visible: boolean;
  title: string;
  subtitle: string;
  /** Primary (black) action — icon optional. */
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  onPrimary: () => void;
  /** Secondary (white) action — icon optional. */
  secondaryLabel: string;
  secondaryIcon?: React.ReactNode;
  onSecondary: () => void;
  onClose: () => void;
}

/**
 * Shared bottom-sheet shell for ProfileView's confirm-style modals (photo
 * picker, logout) — title + subtitle + a black primary and white secondary
 * action. Both modals previously duplicated this entire structure inline.
 */
export function ProfileActionSheet({
  visible,
  title,
  subtitle,
  primaryLabel,
  primaryIcon,
  onPrimary,
  secondaryLabel,
  secondaryIcon,
  onSecondary,
  onClose,
}: ProfileActionSheetProps) {
  const { height } = useWindowDimensions();
  // Absolute px — a % maxHeight resolves against DismissibleSheet's
  // content-sized gesture-root wrapper, mis-measures, and floats the
  // sheet off the bottom of the screen. sheetMaxHeight reads the LIVE
  // window height so this stays correct after rotation / Stage Manager
  // resize instead of freezing at whatever size the app launched at.
  const maxHeight = sheetMaxHeight(height, 0.9);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
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
            sheetColumn,
            { paddingBottom: 50, maxHeight },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={hitSlopTo44(24, 24)}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color={Colors.ink} size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>{subtitle}</Text>

          <View style={{ gap: 12, marginTop: 12 }}>
            <TouchableOpacity
              style={[
                styles.blackBtn,
                { width: "100%", justifyContent: "center", borderWidth: 0 },
              ]}
              onPress={onPrimary}
            >
              {primaryIcon}
              <Text style={styles.blackBtnText}>{primaryLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.whiteBtn, { width: "100%", justifyContent: "center" }]}
              onPress={onSecondary}
            >
              {secondaryIcon}
              <Text style={styles.whiteBtnText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          </View>
        </DismissibleSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    // Gripper hugs the sheet edge (PM: it floated too far down) —
    // 12 matches the sheets that already looked right.
    paddingTop: 12,
    paddingHorizontal: 32,
    paddingBottom: 32,
    // maxHeight is computed live from useWindowDimensions() (see render)
    // and passed inline — see the sheetMaxHeight comment above.
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    ...Type.heading,
    color: Colors.ink,
  },
  modalSubtitle: {
    fontFamily: Fonts.sansLight,
    fontSize: 14,
    color: Colors.body,
    marginBottom: 24,
    lineHeight: 20,
  },
  blackBtn: {
    flexDirection: "row",
    backgroundColor: Colors.ink,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  blackBtnText: {
    color: Colors.paper,
    fontWeight: "700",
    fontSize: 14,
  },
  whiteBtn: {
    flexDirection: "row",
    backgroundColor: Colors.paper,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  whiteBtnText: {
    color: Colors.ink,
    fontWeight: "700",
    fontSize: 14,
  },
});
