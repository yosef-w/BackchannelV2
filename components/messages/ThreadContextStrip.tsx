import { ChevronRight } from "@/components/ui/icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { CompanyLogo } from "../ui/CompanyLogo";
import { Colors } from "@/constants/theme";

interface ThreadContextStripProps {
  jobTitle?: string;
  company?: string;
  logoUrl?: string | null;
  onPress: () => void;
}

/**
 * Slim strip under the thread header pinning which ROLE this conversation
 * is about (threads exist per job). The header above shows who you're
 * talking to — their own title/company — which never answered "about
 * what?", and entering a thread from a multi-role group lost that context
 * entirely. Tapping opens the same profile/role sheet as the header.
 * Renders nothing when the conversation has no job context.
 */
export function ThreadContextStrip({
  jobTitle,
  company,
  logoUrl,
  onPress,
}: ThreadContextStripProps) {
  if (!jobTitle && !company) return null;
  const label = [jobTitle, company].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity
      style={styles.strip}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <CompanyLogo
        logoUrl={logoUrl}
        name={company || jobTitle}
        size={22}
        borderRadius={7}
        initialFontSize={11}
      />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <ChevronRight size={14} color={Colors.faint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 9,
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // The ledger-key voice — which role this thread is about.
  label: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.body,
  },
});
