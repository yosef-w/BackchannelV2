import { AutofillData } from "../stores/useUserProfileStore";

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
 * Check if user profile has all required fields for autofill
 */
export function checkProfileCompleteness(
  data: AutofillData,
): ProfileCompletenessResult {
  const missingFields: Array<{
    category: string;
    field: string;
    label: string;
  }> = [];
  let totalFields = 0;
  let filledFields = 0;

  // Personal Information (Required for autofill)
  const personalChecks = [
    { key: "firstName", label: "First Name", value: data.personal.firstName },
    { key: "lastName", label: "Last Name", value: data.personal.lastName },
    { key: "email", label: "Email", value: data.personal.email },
    { key: "phone", label: "Phone Number", value: data.personal.phone },
    {
      key: "profileImage",
      label: "Profile Photo",
      value: data.personal.profileImage,
    },
    {
      key: "linkedin",
      label: "LinkedIn Profile",
      value: data.personal.linkedin,
    },
    {
      key: "portfolio",
      label: "Portfolio URL",
      value: data.personal.portfolio,
    },
    {
      key: "street",
      label: "Street Address",
      value: data.personal.address.street,
    },
    { key: "city", label: "City", value: data.personal.address.city },
    { key: "state", label: "State", value: data.personal.address.state },
    { key: "zip", label: "Zip Code", value: data.personal.address.zip },
    { key: "country", label: "Country", value: data.personal.address.country },
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

  // Skills (At least 1 required) - Part of main profile display
  totalFields++;
  if (data.skills && data.skills.length > 0) {
    filledFields++;
  } else {
    missingFields.push({
      category: "Personal Information",
      field: "skills",
      label: "Skills & Interests",
    });
  }

  // Professional Information - Check for at least one complete experience entry
  totalFields++;
  const hasValidExperience =
    data.professional.experiences &&
    data.professional.experiences.length > 0 &&
    data.professional.experiences.some(
      (exp) =>
        exp.jobTitle?.trim() && exp.company?.trim() && exp.startDate?.trim(),
    );

  if (hasValidExperience) {
    filledFields++;
  } else {
    missingFields.push({
      category: "Professional",
      field: "experiences",
      label: "At least one work experience",
    });
  }

  // Education Information - Check for at least one complete education entry
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
      label: "At least one degree",
    });
  }

  const percentage = Math.round((filledFields / totalFields) * 100);
  const isComplete = percentage >= 90; // 90% threshold

  return {
    isComplete,
    percentage,
    missingFields,
  };
}
