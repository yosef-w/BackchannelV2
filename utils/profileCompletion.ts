import { AutofillData } from "@/stores/useUserProfileStore";

export interface ProfileCompletenessResult {
  isComplete: boolean;
  percentage: number;
  missingFields: Array<{
    category: string;
    field: string;
    label: string;
  }>;
}

/**
 * Check whether a profile has the fields required to swipe.
 *
 * The required set is deliberately limited to fields the app actually USES —
 * either as a matching signal (scoring.py: skills, role, experience, location)
 * or on the sponsor-facing card (name, photo, bio, experience, education,
 * skills, location). Fields the product never reads — phone, street/ZIP/country
 * (only city is used), portfolio, DOB — are intentionally NOT gated, so users
 * aren't forced to hand-type data that does nothing. (See the onboarding rework
 * notes — Phase 1.)
 *
 * Work experience and education are **applicant-only** requirements — the
 * Résumé section they live in is gated `userType === "applicant"` in
 * ProfileView, so a sponsor has no UI to ever fill them in. Without this
 * `userType` parameter, every sponsor account was permanently flagged
 * "incomplete" and shown "Finish Your Profile" prompts asking for fields
 * they can never provide. Skills IS required for both — sponsors have their
 * own equivalent UI for it ("I Can Help With", same underlying `data.skills`).
 *
 * `isComplete` is true only when EVERY required field is present (not a
 * percentage threshold), so photo and bio are genuinely mandatory rather than
 * skippable-if-you-fill-enough-else. `percentage` is retained purely to drive
 * the progress UI.
 */
export function checkProfileCompleteness(
  data: AutofillData,
  userType: "applicant" | "sponsor" = "applicant",
): ProfileCompletenessResult {
  const missingFields: Array<{
    category: string;
    field: string;
    label: string;
  }> = [];
  let totalFields = 0;
  let filledFields = 0;

  // Identity + display fields the sponsor card renders. `role` (title) and
  // `city` are also matching signals. Phone, street, ZIP, country and state are
  // NOT required — the app never uses them (only city feeds the location
  // signal), so gating on them was pure friction.
  const personalChecks = [
    { key: "firstName", label: "First name", value: data.personal.firstName },
    { key: "lastName", label: "Last name", value: data.personal.lastName },
    { key: "role", label: "Title", value: data.professional.title },
    { key: "email", label: "Email", value: data.personal.email },
    { key: "bio", label: "Bio", value: data.professional.summary },
    {
      key: "profileImage",
      label: "Photo",
      value: data.personal.profileImage,
    },
    { key: "city", label: "City", value: data.personal.address.city },
  ];

  personalChecks.forEach((check) => {
    totalFields++;
    const value = check.value?.trim().toLowerCase();
    if (value && value !== "not set") {
      filledFields++;
    } else {
      missingFields.push({
        category: "Personal Information",
        field: check.key,
        label: check.label,
      });
    }
  });

  // Skills (At least 1 required) - matching signal + card display
  totalFields++;
  if (data.skills && data.skills.length > 0) {
    filledFields++;
  } else {
    missingFields.push({
      category: "Personal Information",
      field: "skills",
      label: "Skills",
    });
  }

  // Professional Information - Check for at least one complete experience
  // entry. Applicant-only — sponsors have no Résumé section to fill this in.
  if (userType === "applicant") {
    totalFields++;
    const hasValidExperience =
      data.professional.experiences &&
      data.professional.experiences.length > 0 &&
      data.professional.experiences.some(
        (exp) => !!(exp.jobTitle?.trim() && exp.company?.trim()),
      );

    if (hasValidExperience) {
      filledFields++;
    } else {
      missingFields.push({
        category: "Professional",
        field: "experiences",
        label: "Work experience",
      });
    }
  }

  // Education Information - Check for at least one complete education entry.
  // Applicant-only — see the experience check above.
  if (userType === "applicant") {
    totalFields++;
    const hasValidEducation =
      data.education.entries &&
      data.education.entries.length > 0 &&
      data.education.entries.some(
        (edu) =>
          edu.degree?.trim() &&
          edu.university?.trim() &&
          edu.graduationYear?.trim(),
      );

    if (hasValidEducation) {
      filledFields++;
    } else {
      missingFields.push({
        category: "Education",
        field: "entries",
        label: "Education",
      });
    }
  }

  const percentage = Math.round((filledFields / totalFields) * 100);
  // Every field in the required set is essential, so completion means none are
  // missing — not merely clearing a percentage bar.
  const isComplete = missingFields.length === 0;

  return {
    isComplete,
    percentage,
    missingFields,
  };
}
