// AsyncStorage flag: set at registration, consumed once by HomeIntro on
// the first Home view, and wiped by sessionTeardown so it never plays for
// the next account on the device. Lives here (not in HomeIntro.tsx) so the
// teardown can import the key without pulling the whole onboarding
// component tree into every logout path.
export const HOME_INTRO_PENDING_KEY = "@bc/homeIntroPending";
