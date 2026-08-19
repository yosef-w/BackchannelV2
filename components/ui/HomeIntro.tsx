// HomeIntro — the first-run product tour shown once, right after a
// newly-signed-up user lands on their real dashboard for the first time.
// Presented as a full-screen Modal over Home (a one-time overlay, not
// real navigation — dismissing it just resumes the Home screen
// underneath).
//
// Wraps components/Onboarding.tsx, whose only appearance in the app is
// here — the pre-signup funnel goes straight from the role's film into
// sign-up with no slides in between.
//
// Role-aware copy; one-time per role (the caller persists the flag),
// replayable via the Home header "?".

import React from "react";
import { Modal } from "react-native";
import { Onboarding } from "@/components/Onboarding";

// AsyncStorage key for the one-time "show the intro" flag. Set when a user
// completes signup; consumed (and cleared) on their first Home view, so the
// intro only ever shows to newly-signed-up users.
export const HOME_INTRO_PENDING_KEY = "@bc/homeIntroPending";

interface HomeIntroProps {
  visible: boolean;
  userType: "applicant" | "sponsor";
  onDone: (action: "complete" | "skip") => void;
}

export function HomeIntro({ visible, userType, onDone }: HomeIntroProps) {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      {/* Modal hides rather than unmounts its children on visible=false —
          mounting Onboarding only while visible forces a fresh instance
          (slide position reset to 0) on every open, including replays. */}
      {visible && (
        <Onboarding
          userType={userType}
          onComplete={() => onDone("complete")}
          onSkip={() => onDone("skip")}
          screenName="home_intro_slides"
        />
      )}
    </Modal>
  );
}
