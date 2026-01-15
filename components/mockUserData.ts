// Mock user data for autofill functionality
export interface UserData {
  personal: {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    linkedin: string;
    portfolio: string;
    website: string;
  };
  professional: {
    title: string;
    yearsExperience: number;
    summary: string;
    skills: string[];
    desiredSalary: string;
    availableStartDate: string;
  };
  education: {
    degree: string;
    major: string;
    university: string;
    graduationYear: string;
    gpa: string;
  };
  workExperience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  demographics: {
    gender: string;
    ethnicity: string;
    veteran: string;
    disability: string;
  };
  preferences: {
    willingToRelocate: string;
    workAuthorization: string;
    securityClearance: string;
    requiresSponsorship: string;
  };
}

export const mockUserData: UserData = {
  personal: {
    firstName: "Jordan",
    lastName: "Mitchell",
    fullName: "Jordan Mitchell",
    email: "jordan.mitchell@email.com",
    phone: "(555) 123-4567",
    address: {
      street: "742 Evergreen Terrace",
      city: "San Francisco",
      state: "CA",
      zip: "94102",
      country: "United States"
    },
    linkedin: "linkedin.com/in/jordanmitchell",
    portfolio: "jordanmitchell.dev",
    website: "https://jordanmitchell.dev"
  },
  professional: {
    title: "Senior Software Engineer",
    yearsExperience: 6,
    summary: "Experienced software engineer specializing in full-stack development with expertise in React, Node.js, and cloud infrastructure. Passionate about building scalable applications and leading technical initiatives.",
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "AWS", "Docker", "Kubernetes", "GraphQL", "PostgreSQL"],
    desiredSalary: "$150,000 - $180,000",
    availableStartDate: "30 days"
  },
  education: {
    degree: "Bachelor of Science",
    major: "Computer Science",
    university: "University of California, Berkeley",
    graduationYear: "2018",
    gpa: "3.7"
  },
  workExperience: [
    {
      company: "Tech Innovators Inc.",
      title: "Senior Software Engineer",
      startDate: "2021-06",
      endDate: "Present",
      description: "Led development of microservices architecture serving 2M+ users. Mentored team of 5 engineers and reduced API response time by 40%."
    },
    {
      company: "StartupXYZ",
      title: "Software Engineer",
      startDate: "2018-08",
      endDate: "2021-05",
      description: "Built core features for SaaS platform using React and Node.js. Implemented CI/CD pipeline and automated testing infrastructure."
    }
  ],
  demographics: {
    gender: "Prefer not to say",
    ethnicity: "Prefer not to say",
    veteran: "No",
    disability: "No"
  },
  preferences: {
    willingToRelocate: "Yes",
    workAuthorization: "US Citizen",
    securityClearance: "None",
    requiresSponsorship: "No"
  }
};