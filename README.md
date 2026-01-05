# Backchannel

Backchannel is a mobile application designed to connect applicants and sponsors. Built with React Native and Expo, it features a role-based experience tailored for both sides of the marketplace.

## Features

- **Role Selection**: Choose between "Applicant" and "Sponsor" modes to get a tailored experience.
- **Interactive Onboarding**: Guided introduction to the platform's features.
- **Questionnaires**: Detailed intake forms to gather necessary information for matching.
- **Matching System**: Find relevant matches based on your profile and preferences.
- **Job Board**: Sponsors can post and manage job listings (Sponsor mode only).
- **Messaging**: Built-in inbox for communication between applicants and sponsors.
- **Profile Management**: Comprehensive profile views and settings.

## Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 54)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/)
- **Animations**: [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) & [Moti](https://moti.fyi/)
- **Icons**: [Lucide React Native](https://lucide.dev/guide/packages/lucide-react-native)
- **Payments**: [RevenueCat](https://www.revenuecat.com/)

## Prerequisites

- **Node.js**: Version 20 is required.
  - This project includes an `.nvmrc` file. If you use `nvm`, run `nvm use` to switch to the correct version.
- **Expo Go**: Download the Expo Go app on your iOS or Android device to run the app during development.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd Backchannel
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Running the App

1.  **Start the development server:**
    ```bash
    npx expo start --tunnel --go -c
    ```
    *   Use `--tunnel` if you are on a different network than your device.
    *   Use `-c` to clear the cache if you encounter issues.

2.  **Open on your device:**
    *   **iOS**: Scan the QR code with the Camera app.
    *   **Android**: Scan the QR code with the Expo Go app.
    *   **Simulator/Emulator**: Press `i` for iOS Simulator or `a` for Android Emulator in the terminal.

## Project Structure

```
Backchannel/
├── app/                 # Expo Router pages and layouts
│   ├── _layout.tsx      # Root layout
│   ├── index.tsx        # Entry point (redirects to splash)
│   ├── splash.tsx       # Splash screen route
│   ├── choose-role.tsx  # Role selection screen
│   ├── onboarding.tsx   # Onboarding flow container
│   └── dashboard.tsx    # Main app dashboard
├── components/          # Reusable UI components and screens
│   ├── MainApp.tsx      # Main tab navigation and layout
│   ├── AuthScreen.tsx   # Authentication UI
│   ├── ...              # Feature-specific views (Home, Jobs, Matches, etc.)
├── assets/              # Images and static assets
├── constants/           # App constants (theme, colors)
├── hooks/               # Custom React hooks
├── lib/                 # Third-party library configurations (RevenueCat)
└── providers/           # Context providers
```

## Troubleshooting

- **Node Version Issues**: If you see errors related to `configs.toReversed` or other version mismatches, ensure you are using Node.js v20. Run `node -v` to check.
- **Cache Issues**: If the app behaves unexpectedly, try starting with the clear cache flag: `npx expo start -c`.
