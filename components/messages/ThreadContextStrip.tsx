import { ChevronRight } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { CompanyLogo } from "../ui/CompanyLogo";

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
      <ChevronRight size={14} color="#BBB" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#F9F9F9",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
});
