import { AutofillData } from '../stores/useUserProfileStore';

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
export function checkProfileCompleteness(data: AutofillData): ProfileCompletenessResult {
  const missingFields: Array<{ category: string; field: string; label: string }> = [];
  let totalFields = 0;
  let filledFields = 0;

  // Personal Information (Required for autofill)
  const personalChecks = [
    { key: 'firstName', label: 'First Name', value: data.personal.firstName },
    { key: 'lastName', label: 'Last Name', value: data.personal.lastName },
    { key: 'email', label: 'Email', value: data.personal.email },
    { key: 'phone', label: 'Phone Number', value: data.personal.phone },
    { key: 'profileImage', label: 'Profile Photo', value: data.personal.profileImage },
    { key: 'linkedin', label: 'LinkedIn Profile', value: data.personal.linkedin },
    { key: 'portfolio', label: 'Portfolio URL', value: data.personal.portfolio },
    { key: 'street', label: 'Street Address', value: data.personal.address.street },
    { key: 'city', label: 'City', value: data.personal.address.city },
    { key: 'state', label: 'State', value: data.personal.address.state },
    { key: 'zip', label: 'Zip Code', value: data.personal.address.zip },
    { key: 'country', label: 'Country', value: data.personal.address.country },
  ];

  personalChecks.forEach(check => {
    totalFields++;
    const value = check.value?.trim().toLowerCase();
    if (value && value !== 'not set') {
      filledFields++;
    } else {
      missingFields.push({
        category: 'Personal Information',
        field: check.key,
        label: check.label,
      });
    }
  });

  // Professional Information
  const professionalChecks = [
    { key: 'title', label: 'Current Job Title', value: data.professional.title },
    { key: 'yearsExperience', label: 'Years of Experience', value: data.professional.yearsExperience },
    { key: 'summary', label: 'Professional Summary', value: data.professional.summary },
  ];

  professionalChecks.forEach(check => {
    totalFields++;
    const value = check.value?.trim().toLowerCase();
    if (value && value !== 'not set') {
      filledFields++;
    } else {
      missingFields.push({
        category: 'Professional',
        field: check.key,
        label: check.label,
      });
    }
  });

  // Education Information
  const educationChecks = [
    { key: 'degree', label: 'Degree', value: data.education.degree },
    { key: 'university', label: 'University', value: data.education.university },
    { key: 'graduationYear', label: 'Graduation Year', value: data.education.graduationYear },
  ];

  educationChecks.forEach(check => {
    totalFields++;
    const value = check.value?.trim().toLowerCase();
    if (value && value !== 'not set') {
      filledFields++;
    } else {
      missingFields.push({
        category: 'Education',
        field: check.key,
        label: check.label,
      });
    }
  });

  // Preferences (Important for applications)
  const preferenceChecks = [
    { key: 'workAuthorization', label: 'Work Authorization', value: data.preferences.workAuthorization },
  ];

  preferenceChecks.forEach(check => {
    totalFields++;
    const value = check.value?.trim().toLowerCase();
    if (value && value !== 'not set') {
      filledFields++;
    } else {
      missingFields.push({
        category: 'Work Preferences',
        field: check.key,
        label: check.label,
      });
    }
  });

  // Skills (At least 1 required)
  totalFields++;
  if (data.skills && data.skills.length > 0) {
    filledFields++;
  } else {
    missingFields.push({
      category: 'Skills',
      field: 'skills',
      label: 'Skills',
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
