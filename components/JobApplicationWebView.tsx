import { BlurView } from "expo-blur";
import { Sparkles, X, CheckCircle, AlertCircle } from "lucide-react-native";
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
} from "react-native-reanimated";
import { useUserProfileStore } from "../stores/useUserProfileStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface JobApplicationWebViewProps {
  jobUrl: string;
  jobTitle: string;
  company: string;
  onClose: () => void;
}

export function JobApplicationWebView({
  jobUrl,
  jobTitle,
  company,
  onClose,
}: JobApplicationWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [showAutofillButton, setShowAutofillButton] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<"idle" | "filling" | "success" | "error">("idle");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const profileData = useUserProfileStore((state) => state.data);
  const isProfileLoaded = useUserProfileStore((state) => state.isLoaded);

  const generateAutofillScript = () => {
    if (!isProfileLoaded) {
      console.warn('Autofill data not loaded yet');
      return '';
    }
    
    const userData = {
      personal: {
        firstName: profileData.personal.firstName,
        lastName: profileData.personal.lastName,
        fullName: profileData.personal.fullName,
        email: profileData.personal.email,
        phone: profileData.personal.phone,
        linkedin: profileData.personal.linkedin,
        portfolio: profileData.personal.portfolio,
        address: {
          street: profileData.personal.address.street,
          city: profileData.personal.address.city,
          state: profileData.personal.address.state,
          zip: profileData.personal.address.zip,
          county: profileData.personal.address.city,
          country: profileData.personal.address.country,
        },
      },
      professional: {
        title: profileData.professional.title || profileData.professional.seekingPosition,
        yearsExperience: profileData.professional.yearsExperience,
        summary: profileData.professional.summary,
      },
      education: {
        degree: profileData.education.degree,
        university: profileData.education.university,
        graduationYear: profileData.education.graduationYear,
      },
    };
    
    return `
      (function() {
        // Comprehensive helper to find inputs using multiple strategies
        function findInput(keywords, options = {}) {
          const { type = 'any', excludeTypes = [], excludePatterns = [] } = options;
          
          // Helper to check if element is valid (not hidden, not recaptcha, etc.)
          function isValidElement(el, excludePatterns = []) {
            if (!el) return false;
            
            // Exclude reCAPTCHA and other automated fields
            const id = el.id || '';
            const name = el.name || '';
            const className = el.className || '';
            
            if (id.includes('recaptcha') || name.includes('recaptcha') || 
                id.includes('g-recaptcha') || name.includes('g-recaptcha') ||
                className.includes('recaptcha')) {
              return false;
            }
            
            // Exclude hidden fields
            if (el.type === 'hidden') return false;
            
            // Check for additional exclude patterns (e.g., country code fields for phone)
            for (const pattern of excludePatterns) {
              if (id.toLowerCase().includes(pattern) || name.toLowerCase().includes(pattern)) {
                return false;
              }
            }
            
            return true;
          }
          
          // Try to find by name/id first (most specific)
          for (const kw of keywords) {
            const kwLower = kw.toLowerCase();
            
            // Priority 1: Exact name match
            let element = document.querySelector(\`input[name="\${kwLower}"], textarea[name="\${kwLower}"], select[name="\${kwLower}"]\`);
            if (isValidElement(element, excludePatterns)) return element;
            
            // Priority 2: Exact id match
            element = document.querySelector(\`input[id="\${kwLower}"], textarea[id="\${kwLower}"], select[id="\${kwLower}"]\`);
            if (isValidElement(element, excludePatterns)) return element;
            
            // Priority 3: Name/ID contains keyword
            element = document.querySelector(\`input[name*="\${kwLower}" i], textarea[name*="\${kwLower}" i], select[name*="\${kwLower}" i]\`);
            if (isValidElement(element, excludePatterns)) return element;
            
            element = document.querySelector(\`input[id*="\${kwLower}" i], textarea[id*="\${kwLower}" i], select[id*="\${kwLower}" i]\`);
            if (isValidElement(element, excludePatterns)) return element;
          }
          
          // Priority 4: data-* attributes, placeholder, aria-label (but not class)
          for (const kw of keywords) {
            const kwLower = kw.toLowerCase();
            
            let element = document.querySelector(\`input[placeholder*="\${kwLower}" i], textarea[placeholder*="\${kwLower}" i]\`);
            if (isValidElement(element, excludePatterns)) return element;
            
            element = document.querySelector(\`input[aria-label*="\${kwLower}" i], textarea[aria-label*="\${kwLower}" i], select[aria-label*="\${kwLower}" i]\`);
            if (isValidElement(element, excludePatterns)) return element;
            
            element = document.querySelector(\`input[data-testid*="\${kwLower}" i], textarea[data-testid*="\${kwLower}" i], select[data-testid*="\${kwLower}" i]\`);
            if (isValidElement(element, excludePatterns)) return element;
          }
          
          // Priority 5: Try finding by associated label
          for (const kw of keywords) {
            const kwLower = kw.toLowerCase();
            const labels = document.querySelectorAll('label');
            
            for (const label of labels) {
              const labelText = label.textContent?.toLowerCase() || '';
              // More strict matching - label text should start with or exactly match the keyword
              if (labelText.trim().startsWith(kwLower) || labelText.trim() === kwLower) {
                const forAttr = label.getAttribute('for');
                let element;
                
                if (forAttr) {
                  element = document.getElementById(forAttr);
                } else {
                  element = label.querySelector('input, textarea, select');
                }
                
                if (isValidElement(element, excludePatterns)) return element;
              }
            }
          }
          
          // Filter by type if specified
          if (excludeTypes.length > 0) {
            // This check is already done, just return null if needed
          }
          
          return null;
        }

        // Enhanced helper to set input value with better event handling
        function setInputValue(element, value, fieldName = 'unknown') {
          if (!element || value === null || value === undefined) {
            return false;
          }
          
          const currentValue = element.value?.trim() || '';
          
          // Don't overwrite if field already has a meaningful value
          if (currentValue.length > 0) {
            return false;
          }
          
          // Handle different input types
          const tagName = element.tagName.toLowerCase();
          const inputType = element.type?.toLowerCase() || 'text';
          
          // Convert value to string
          const stringValue = String(value);
          
          try {
            // Special handling for React controlled inputs (like Greenhouse)
            // This is the key to making it work with React forms
            
            // Step 1: Get the native setter before React's wrapper
            let nativeSetter;
            if (tagName === 'input') {
              nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            } else if (tagName === 'textarea') {
              nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            }
            
            // Step 2: Set value using native setter (bypasses React's control)
            if (nativeSetter) {
              nativeSetter.call(element, stringValue);
            } else {
              element.value = stringValue;
            }
            
            // Step 3: Dispatch input event to trigger React's onChange
            // This is critical for React to recognize the change
            try {
              const inputEvent = new Event('input', { bubbles: true });
              // Set the special React properties
              Object.defineProperty(inputEvent, 'target', { writable: false, value: element });
              element.dispatchEvent(inputEvent);
            } catch (e) {
              // Fallback to standard input event
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Step 4: Dispatch change event
            try {
              element.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
              // Continue
            }
            
            // Step 5: Focus and blur to trigger validation
            try {
              element.focus();
              element.dispatchEvent(new Event('blur', { bubbles: true }));
            } catch (e) {
              // Continue
            }
            
            return true;
          } catch (error) {
            return false;
          }
        }

        // Enhanced dropdown option selector with fuzzy matching
        function selectOption(element, value) {
          if (!element || !value) return false;
          
          const tagName = element.tagName.toLowerCase();
          const stringValue = String(value).toLowerCase();
          
          if (tagName === 'select') {
            const options = Array.from(element.options || []);
            
            // Try exact match first
            let matchingOption = options.find(opt => 
              opt.value.toLowerCase() === stringValue ||
              opt.text.toLowerCase() === stringValue
            );
            
            // Try partial match
            if (!matchingOption) {
              matchingOption = options.find(opt => 
                opt.value.toLowerCase().includes(stringValue) ||
                opt.text.toLowerCase().includes(stringValue) ||
                stringValue.includes(opt.value.toLowerCase()) ||
                stringValue.includes(opt.text.toLowerCase())
              );
            }
            
            if (matchingOption) {
              element.value = matchingOption.value;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              element.dispatchEvent(new Event('blur', { bubbles: true }));
              return true;
            }
          }
          
          return false;
        }

        // Helper to handle radio buttons
        function selectRadio(name, value) {
          const radios = document.querySelectorAll(\`input[type="radio"][name*="\${name}" i]\`);
          const stringValue = String(value).toLowerCase();
          
          for (const radio of radios) {
            const radioValue = (radio.value || '').toLowerCase();
            const radioLabel = radio.labels?.[0]?.textContent?.toLowerCase() || '';
            
            if (radioValue === stringValue || radioLabel.includes(stringValue) || stringValue.includes(radioLabel)) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
          return false;
        }

        // Helper to handle checkboxes
        function checkBox(keywords, shouldCheck = true) {
          const element = findInput(keywords, { type: 'checkbox' });
          if (element && element.type === 'checkbox') {
            element.checked = shouldCheck;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        }

        let filledCount = 0;
        console.log('[AUTOFILL] 🚀 Starting autofill process...');
        console.log('[AUTOFILL] 📋 User data loaded for:', '${userData.personal.firstName}', '${userData.personal.lastName}');

        // === PERSONAL INFORMATION ===
        
        // Name fields - comprehensive coverage
        if (setInputValue(findInput(['firstname', 'first_name', 'fname', 'givenname', 'first-name', 'given_name', 'given-name', 'forename', 'applicant_first_name']), '${userData.personal.firstName}', 'First Name')) filledCount++;
        
        if (setInputValue(findInput(['lastname', 'last_name', 'lname', 'surname', 'familyname', 'last-name', 'family_name', 'family-name', 'applicant_last_name']), '${userData.personal.lastName}', 'Last Name')) filledCount++;
        
        if (setInputValue(findInput(['fullname', 'full_name', 'full-name', 'name', 'applicantname', 'applicant_name', 'your_name', 'yourname', 'candidate_name', 'legal_name', 'legalname'], { excludeTypes: ['firstname', 'lastname', 'first', 'last'] }), '${userData.personal.fullName}', 'Full Name')) filledCount++;
        
        // Middle name support
        if (setInputValue(findInput(['middlename', 'middle_name', 'middle-name', 'mname', 'middleinitial', 'middle_initial']), '', 'Middle Name')) filledCount++;
        
        // Email - very comprehensive
        if (setInputValue(findInput(['email', 'e-mail', 'mail', 'emailaddress', 'email_address', 'email-address', 'e_mail', 'applicant_email', 'contact_email', 'youremail', 'your_email', 'user_email', 'useremail']), '${userData.personal.email}', 'Email')) filledCount++;
        
        // Phone - comprehensive with variations, excluding country code selectors
        if (setInputValue(findInput(['phone', 'telephone', 'mobile', 'cell', 'phonenumber', 'phone_number', 'phone-number', 'tel', 'cellphone', 'cell_phone', 'mobilephone', 'mobile_phone', 'contact_number', 'contactnumber', 'primaryphone', 'primary_phone', 'home_phone', 'homephone', 'mobile_number', 'mobilenumber', 'telephone_number', 'telephonenumber', 'phone-num', 'phonenum', 'telnumber', 'tel_number', 'contact_phone', 'contactphone', 'phoneno', 'phone_no', 'telno', 'tel_no'], { excludePatterns: ['countrycode', 'country_code', 'country-code', 'phonecode', 'phone_code', 'phone-code', 'countryphone', 'country_phone'] }), '${userData.personal.phone}', 'Phone')) filledCount++;
        
        // === ADDRESS FIELDS ===
        
        // Street address - comprehensive
        if (setInputValue(findInput(['address', 'street', 'address1', 'addressline1', 'address_line_1', 'address-line-1', 'street_address', 'streetaddress', 'street-address', 'address_1', 'addr1', 'line1', 'addressline', 'streetline1']), '${userData.personal.address.street}', 'Street Address')) filledCount++;
        
        // Address line 2 (optional, leave blank)
        if (setInputValue(findInput(['address2', 'addressline2', 'address_line_2', 'address-line-2', 'address_2', 'addr2', 'line2', 'apt', 'apartment', 'suite', 'unit']), '', 'Address Line 2')) filledCount++;
        
        // City
        if (setInputValue(findInput(['city', 'town', 'locality', 'municipality', 'cityname', 'city_name']), '${userData.personal.address.city}', 'City')) filledCount++;
        
        // State/Province - handle both input and select
        let stateElement = findInput(['state', 'province', 'region', 'stateprovince', 'state_province', 'state-province', 'st', 'prov']);
        if (stateElement) {
          if (stateElement.tagName.toLowerCase() === 'select') {
            if (selectOption(stateElement, '${userData.personal.address.state}')) {
              filledCount++;
            }
          } else {
            if (setInputValue(stateElement, '${userData.personal.address.state}', 'State')) filledCount++;
          }
        }
        
        // County (often used in address forms)
        if (setInputValue(findInput(['county', 'countyname', 'county_name', 'county-name']), '${userData.personal.address.state}', 'County')) filledCount++;
        
        // Zip/Postal Code
        if (setInputValue(findInput(['zip', 'postal', 'postcode', 'zipcode', 'zip_code', 'zip-code', 'postal_code', 'postal-code', 'postalcode', 'pincode', 'pin']), '${userData.personal.address.zip}', 'Zip Code')) filledCount++;
        
        // Country / Region of Residence
        if (setInputValue(findInput(['country', 'nation', 'countryname', 'country_name', 'country-name', 'residence', 'countryofresidence', 'country_of_residence', 'country-of-residence', 'region', 'regionofresidence', 'region_of_residence', 'countryregion', 'country_region', 'location_country']), '${userData.personal.address.country}', 'Country/Region')) filledCount++;
        
        // === PROFESSIONAL LINKS ===
        
        // LinkedIn - comprehensive
        if (setInputValue(findInput(['linkedin', 'linked-in', 'linked_in', 'linkedinurl', 'linkedin_url', 'linkedinprofile', 'linkedin_profile']), '${userData.personal.linkedin}', 'LinkedIn')) filledCount++;
        
        // Portfolio/Website
        if (setInputValue(findInput(['portfolio', 'website', 'url', 'personalwebsite', 'personal_website', 'weburl', 'web_url', 'site', 'homepage', 'portfoliourl', 'portfolio_url', 'portfoliosite']), '${userData.personal.portfolio}', 'Portfolio')) filledCount++;
        
        // GitHub
        if (setInputValue(findInput(['github', 'git-hub', 'git_hub', 'githuburl', 'github_url', 'githubprofile', 'github_profile', 'githubusername']), '', 'GitHub')) filledCount++;
        
        // === PROFESSIONAL INFORMATION ===
        
        // Current/Desired Job Title
        if (setInputValue(findInput(['title', 'jobtitle', 'job_title', 'job-title', 'position', 'currenttitle', 'current_title', 'current-title', 'currentposition', 'current_position', 'role', 'currentrole', 'current_role', 'designation', 'desiredtitle', 'desired_title', 'positiontitle']), '${userData.professional.title}', 'Job Title')) filledCount++;
        
        // Years of Experience - comprehensive
        if (setInputValue(findInput(['experience', 'years', 'yearsofexperience', 'years_of_experience', 'years-of-experience', 'yearsexperience', 'yoe', 'experienceyears', 'experience_years', 'totalexperience', 'total_experience', 'workexperience', 'work_experience']), '${userData.professional.yearsExperience}', 'Years of Experience')) filledCount++;
        
        // Professional Summary/Bio
        if (setInputValue(findInput(['summary', 'bio', 'about', 'objective', 'professionsalsummary', 'professional_summary', 'careersummary', 'career_summary', 'biography', 'aboutme', 'about_me', 'profile', 'overview', 'introduction', 'coverletter', 'cover_letter']), '${userData.professional.summary}', 'Professional Summary')) filledCount++;
        
        // Salary Expectations
        if (setInputValue(findInput(['salary', 'compensation', 'expectedsalary', 'expected_salary', 'expected-salary', 'salaryexpectation', 'salary_expectation', 'salaryexpectations', 'desiredsalary', 'desired_salary', 'salaryrequirement', 'salary_requirement', 'pay', 'payrequirement', 'currentcompensation', 'current_compensation']), '${userData.professional.desiredSalary}', 'Salary Expectations')) filledCount++;
        
        // Start Date/Availability
        if (setInputValue(findInput(['startdate', 'start_date', 'start-date', 'availability', 'availabledate', 'available_date', 'availableto start', 'availabletostart', 'available_to_start', 'startavailability', 'start_availability', 'joindate', 'join_date', 'when']), '${userData.professional.availableStartDate}', 'Start Date')) filledCount++;
        
        // === EDUCATION ===
        
        // Degree
        if (setInputValue(findInput(['degree', 'education', 'educationlevel', 'education_level', 'highestdegree', 'highest_degree', 'degreetitle', 'degree_title', 'qualification', 'academicdegree', 'academic_degree']), '${userData.education.degree}', 'Degree')) filledCount++;
        
        // Major/Field of Study - specific keywords only
        if (setInputValue(findInput(['major', 'fieldofstudy', 'field_of_study', 'field-of-study', 'studyfield', 'study_field', 'majorfield', 'major_field', 'concentration', 'specialization', 'areaof study', 'area_of_study', 'discipline', 'coursesofstudy']), '${userData.education.major}', 'Major/Field of Study')) filledCount++;
        
        // University/School - comprehensive
        if (setInputValue(findInput(['university', 'school', 'college', 'institution', 'universityname', 'university_name', 'schoolname', 'school_name', 'collegename', 'college_name', 'educationalinstitution', 'educational_institution', 'alma_mater', 'almamater', 'institutionname']), '${userData.education.university}', 'University/School')) filledCount++;
        
        // Graduation Year
        if (setInputValue(findInput(['graduation', 'gradyear', 'grad_year', 'graduationyear', 'graduation_year', 'graduation-year', 'yearofgraduation', 'year_of_graduation', 'yeargraduated', 'year_graduated', 'graddate', 'grad_date', 'graduationdate', 'completion_year', 'completionyear']), '${userData.education.graduationYear}', 'Graduation Year')) filledCount++;
        
        // GPA
        if (setInputValue(findInput(['gpa', 'grade', 'gradepoint', 'grade_point', 'gradepointaverage', 'grade_point_average', 'cgpa', 'cumulative_gpa', 'cumulativegpa', 'academicaverage', 'academic_average']), '${userData.education.gpa}', 'GPA')) filledCount++;
        
        // === WORK AUTHORIZATION & PREFERENCES ===
        
        // Work Authorization - handle as both select and text
        let authElement = findInput(['authorization', 'workauth', 'work_auth', 'workauthorization', 'work_authorization', 'work-authorization', 'employmentauthorization', 'employment_authorization', 'legallyauthorized', 'legally_authorized', 'righttowork', 'right_to_work']);
        if (authElement) {
          if (authElement.tagName.toLowerCase() === 'select') {
            if (selectOption(authElement, '${userData.preferences.workAuthorization}')) filledCount++;
          } else {
            if (setInputValue(authElement, '${userData.preferences.workAuthorization}')) filledCount++;
          }
        }
        
        // Willing to Relocate
        let relocateElement = findInput(['relocate', 'relocation', 'willingtorelocate', 'willing_to_relocate', 'willing-to-relocate', 'relocatequestion', 'relocatable', 'move', 'willingtomove', 'opentorelocate', 'open_to_relocate']);
        if (relocateElement) {
          if (relocateElement.tagName.toLowerCase() === 'select') {
            if (selectOption(relocateElement, '${userData.preferences.willingToRelocate}')) filledCount++;
          } else if (relocateElement.type === 'radio') {
            if (selectRadio('relocate', '${userData.preferences.willingToRelocate}')) filledCount++;
          } else {
            if (setInputValue(relocateElement, '${userData.preferences.willingToRelocate}')) filledCount++;
          }
        }
        
        // Visa Sponsorship
        let sponsorElement = findInput(['sponsor', 'sponsorship', 'visasponsorship', 'visa_sponsorship', 'visa-sponsorship', 'requiresponsorship', 'require_sponsorship', 'needsponsorship', 'need_sponsorship', 'visa', 'visarequirement', 'visa_requirement']);
        if (sponsorElement) {
          if (sponsorElement.tagName.toLowerCase() === 'select') {
            if (selectOption(sponsorElement, '${userData.preferences.requiresSponsorship}')) filledCount++;
          } else if (sponsorElement.type === 'radio') {
            if (selectRadio('sponsor', '${userData.preferences.requiresSponsorship}')) filledCount++;
          } else {
            if (setInputValue(sponsorElement, '${userData.preferences.requiresSponsorship}')) filledCount++;
          }
        }
        
        // Security Clearance
        let clearanceElement = findInput(['clearance', 'securityclearance', 'security_clearance', 'security-clearance', 'clearancelevel', 'clearance_level']);
        if (clearanceElement) {
          if (clearanceElement.tagName.toLowerCase() === 'select') {
            if (selectOption(clearanceElement, '${userData.preferences.securityClearance}')) filledCount++;
          } else {
            if (setInputValue(clearanceElement, '${userData.preferences.securityClearance}')) filledCount++;
          }
        }
        
        // === DEMOGRAPHICS (EEO) ===
        
        // Gender
        let genderElement = findInput(['gender', 'sex', 'genderidentity', 'gender_identity']);
        if (genderElement) {
          if (genderElement.tagName.toLowerCase() === 'select') {
            if (selectOption(genderElement, '${userData.demographics.gender}')) filledCount++;
          } else if (genderElement.type === 'radio') {
            if (selectRadio('gender', '${userData.demographics.gender}')) filledCount++;
          }
        }
        
        // Ethnicity/Race
        let ethnicityElement = findInput(['ethnicity', 'race', 'raceethnicity', 'race_ethnicity', 'ethnic', 'racialidentity']);
        if (ethnicityElement) {
          if (ethnicityElement.tagName.toLowerCase() === 'select') {
            if (selectOption(ethnicityElement, '${userData.demographics.ethnicity}')) filledCount++;
          }
        }
        
        // Veteran Status
        let veteranElement = findInput(['veteran', 'veteranstatus', 'veteran_status', 'veteran-status', 'militaryveteran', 'military_veteran', 'armedforces', 'armed_forces']);
        if (veteranElement) {
          if (veteranElement.tagName.toLowerCase() === 'select') {
            if (selectOption(veteranElement, '${userData.demographics.veteran}')) filledCount++;
          } else if (veteranElement.type === 'radio') {
            if (selectRadio('veteran', '${userData.demographics.veteran}')) filledCount++;
          }
        }
        
        // Disability Status
        let disabilityElement = findInput(['disability', 'disabilitystatus', 'disability_status', 'disability-status', 'disabled', 'handicap']);
        if (disabilityElement) {
          if (disabilityElement.tagName.toLowerCase() === 'select') {
            if (selectOption(disabilityElement, '${userData.demographics.disability}')) filledCount++;
          } else if (disabilityElement.type === 'radio') {
            if (selectRadio('disability', '${userData.demographics.disability}')) filledCount++;
          }
        }
        
        // === ADDITIONAL COMMON FIELDS ===
        
        // Referral Source / How did you hear about us - handle both input and select
        let referralElement = findInput(['referral', 'source', 'heardabout', 'heard_about', 'howdidyouhear', 'how_did_you_hear', 'referralsource', 'referral_source', 'jobsource', 'sourcetype']);
        if (referralElement) {
          if (referralElement.tagName.toLowerCase() === 'select') {
            if (selectOption(referralElement, 'Online Job Board')) {
              filledCount++;
            }
          } else {
            if (setInputValue(referralElement, 'Online Job Board', 'Referral Source')) filledCount++;
          }
        }
        
        // Cover Letter / Additional Info
        if (setInputValue(findInput(['coverletter', 'cover_letter', 'cover-letter', 'letter', 'additionalinfo', 'additional_info', 'additional-info', 'additionalinformation', 'comments', 'message', 'notes']), '${userData.professional.summary}', 'Cover Letter')) filledCount++;

        console.log('[AUTOFILL] ✨ Autofill complete! Total fields filled:', filledCount);

        // Send result back to React Native
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AUTOFILL_COMPLETE',
          filledCount: filledCount
        }));
      })();
    `;
  };

  // Simplified injected script - just notify that page is ready
  const injectedJavaScript = `
    (function() {
      // Intercept console.log and forward to React Native
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      
      console.log = function(...args) {
        originalLog.apply(console, args);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONSOLE_LOG',
          level: 'log',
          message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        }));
      };
      
      console.error = function(...args) {
        originalError.apply(console, args);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONSOLE_LOG',
          level: 'error',
          message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        }));
      };
      
      console.warn = function(...args) {
        originalWarn.apply(console, args);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONSOLE_LOG',
          level: 'warn',
          message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        }));
      };
      
      // Notify React Native that page is ready
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAGE_READY'
      }));
    })();
    
    true; // Required for iOS
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === "PAGE_READY") {
        console.log("[WebView] Page ready, showing autofill button");
        setShowAutofillButton(true);
      } else if (data.type === "AUTOFILL_COMPLETE") {
        console.log("[WebView] Autofill complete, filled fields:", data.filledCount);
        setAutofillStatus("success");
        
        // Show success message
        Alert.alert(
          "Success!",
          `Filled ${data.filledCount} fields with your information. Please review and submit.`,
          [{ text: "Got it", onPress: () => setAutofillStatus("idle") }]
        );
      } else if (data.type === "CONSOLE_LOG") {
        // Forward WebView console logs to React Native console
        const prefix = `[WebView Console]`;
        if (data.level === 'error') {
          console.error(prefix, data.message);
        } else if (data.level === 'warn') {
          console.warn(prefix, data.message);
        } else {
          console.log(prefix, data.message);
        }
      }
    } catch (error) {
      console.error("Error parsing WebView message:", error);
      setAutofillStatus("error");
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
  };

  const handleAutofill = () => {
    console.log("[JobApplicationWebView] Starting autofill process...");
    setAutofillStatus("filling");
    
    // Execute autofill script
    setTimeout(() => {
      console.log("[JobApplicationWebView] Injecting autofill script into WebView");
      webViewRef.current?.injectJavaScript(generateAutofillScript());
    }, 300);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X color="#000" size={24} />
            </TouchableOpacity>
            <View style={styles.jobInfo}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {jobTitle}
              </Text>
              <Text style={styles.companyName} numberOfLines={1}>
                {company}
              </Text>
            </View>
          </View>
          
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              onPress={() => webViewRef.current?.goBack()}
              disabled={!canGoBack}
              style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
            >
              <Text style={[styles.navButtonText, !canGoBack && styles.navButtonTextDisabled]}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => webViewRef.current?.goForward()}
              disabled={!canGoForward}
              style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
            >
              <Text style={[styles.navButtonText, !canGoForward && styles.navButtonTextDisabled]}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: jobUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onMessage={handleWebViewMessage}
          injectedJavaScript={injectedJavaScript}
          onNavigationStateChange={handleNavigationStateChange}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={styles.loadingText}>Loading application...</Text>
            </View>
          )}
        />

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        )}

        {/* Autofill Status Overlay */}
        {autofillStatus === "filling" && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={styles.statusOverlay}
          >
            <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="light" />
            <Animated.View entering={ZoomIn} style={styles.statusCard}>
              <View style={styles.statusIcon}>
                <Sparkles color="#000" size={32} />
              </View>
              <Text style={styles.statusTitle}>Filling Form...</Text>
              <Text style={styles.statusSubtitle}>
                Adding your information to the application
              </Text>
              <ActivityIndicator size="large" color="#000" style={{ marginTop: 20 }} />
            </Animated.View>
          </Animated.View>
        )}

        {/* Native Autofill Button */}
        {showAutofillButton && autofillStatus === "idle" && (
          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={styles.autofillButtonContainer}
          >
            <TouchableOpacity
              style={styles.autofillButton}
              onPress={handleAutofill}
              activeOpacity={0.8}
            >
              <Sparkles color="#FFF" size={20} />
              <Text style={styles.autofillButtonText}>Autofill with AI</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  companyName: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  navigationButtons: {
    flexDirection: "row",
    gap: 8,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  navButtonTextDisabled: {
    color: "#999",
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  statusOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    maxWidth: SCREEN_WIDTH - 64,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.2,
        shadowRadius: 25,
      },
      android: {
        elevation: 15,
      },
    }),
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  autofillButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  autofillButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  autofillButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
});