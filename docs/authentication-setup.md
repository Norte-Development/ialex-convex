# Authentication & Onboarding Setup

This document describes how to set up and configure the Clerk authentication system with the iAlex legal case management application.

## Overview

The application now uses Clerk for authentication with a custom onboarding flow that collects professional information from new users. The system includes:

- **Clerk Authentication**: Secure user authentication and management
- **Database Sync**: Automatic user synchronization with Convex database
- **Onboarding Flow**: Multi-step process to collect professional information
- **Role-based Access**: Support for different user roles (admin, lawyer, assistant)

## Setup Instructions

### 1. Clerk Account Setup

1. **Create Clerk Account**
   - Go to [https://clerk.com](https://clerk.com)
   - Create a new account or sign in
   - Create a new application

2. **Get API Keys**
   - In your Clerk Dashboard, go to "API Keys"
   - Copy the "Publishable Key"

3. **Configure JWT Template**
   - Go to "JWT Templates" in the Clerk Dashboard
   - Create a new template named "convex"
   - Use the default settings
   - Copy the "Issuer URL"

### 2. Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Convex Configuration
VITE_CONVEX_URL=<your_convex_deployment_url>

# Clerk Authentication Configuration
VITE_CLERK_PUBLISHABLE_KEY=<your_clerk_publishable_key>

# Clerk JWT Issuer Domain (for Convex integration)
CLERK_JWT_ISSUER_DOMAIN=<your_clerk_jwt_issuer_domain>
```

### 3. Convex Dashboard Configuration

1. Go to your [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Go to "Settings" > "Environment Variables"
4. Add the `CLERK_JWT_ISSUER_DOMAIN` variable with the issuer URL from Clerk

### 4. Run the Application

```bash
npm install
npm run dev
```

## User Flow

### Authentication Process

1. **First Visit**: Users see the sign-in page with Clerk authentication
2. **New User Registration**: Users can create accounts through Clerk
3. **Database Sync**: User data is automatically synced to Convex database
4. **Onboarding**: New users go through a 4-step onboarding process
5. **Main Application**: Completed users access the full application

### Onboarding Steps

#### Step 1: Role Selection
- User selects their primary role (Lawyer, Legal Assistant, Administrator)
- Optional bar number entry for lawyers

#### Step 2: Legal Specializations
- Selection from 12 predefined legal specialization areas
- Multiple selections allowed

#### Step 3: Professional Information
- Firm/practice name (optional)
- Work location (optional)
- Years of experience (optional)

#### Step 4: Professional Biography
- Free-text biography (optional, 500 character limit)
- Summary review of all entered information

## Database Schema Changes

### Users Table Updates

The `users` table has been enhanced with the following fields:

```typescript
{
  // Clerk integration
  clerkId: string,                    // Clerk user ID
  
  // Onboarding status
  isOnboardingComplete: boolean,      // Whether onboarding is finished
  onboardingStep?: number,            // Current step in onboarding
  
  // Professional information
  specializations?: string[],         // Legal specializations
  barNumber?: string,                 // Bar registration number
  firmName?: string,                  // Law firm name
  workLocation?: string,              // Work location
  experienceYears?: number,           // Years of experience
  bio?: string,                       // Professional biography
}
```

## API Functions

### New Convex Functions

#### `getOrCreateUser`
```typescript
// Syncs Clerk user with database
const userId = await getOrCreateUser({
  clerkId: "user_abc123",
  email: "user@example.com", 
  name: "John Doe"
});
```

#### `getCurrentUser`
```typescript
// Gets current user by Clerk ID
const user = await getCurrentUser({ 
  clerkId: "user_abc123" 
});
```

#### `updateOnboardingInfo`
```typescript
// Updates user onboarding information
await updateOnboardingInfo({
  clerkId: "user_abc123",
  role: "lawyer",
  specializations: ["Derecho Civil", "Derecho Penal"],
  barNumber: "12345",
  firmName: "Smith & Associates",
  isOnboardingComplete: true
});
```

#### `getUsersNeedingOnboarding`
```typescript
// Gets all users who haven't completed onboarding
const incompleteUsers = await getUsersNeedingOnboarding();
```

## Component Architecture

### AuthWrapper
- Handles all authentication states
- Shows loading, sign-in, onboarding, or main app
- Wraps the entire application

### OnboardingFlow
- Multi-step form for collecting user information
- Progress indicator and navigation
- Form validation and submission

### UserProfileButton
- Clerk UserButton component for profile management
- Integrated in the navigation bar

## Security Considerations

1. **JWT Validation**: Convex automatically validates Clerk JWTs
2. **User Sync**: Database users are always synced with Clerk users
3. **Role-based Access**: User roles control access to features
4. **Data Protection**: All user data is stored securely in Convex

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   - Ensure all required environment variables are configured
   - Check both local `.env.local` and Convex Dashboard settings

2. **JWT Issuer Domain Mismatch**
   - Verify the issuer domain matches between Clerk and Convex
   - Check the JWT template configuration in Clerk

3. **User Not Syncing**
   - Check browser console for errors
   - Verify Convex functions are deployed
   - Ensure network connectivity to both Clerk and Convex

4. **Onboarding Not Triggering**
   - Check that `isOnboardingComplete` is `false` for new users
   - Verify the AuthWrapper logic

### Development Tips

1. **Testing Authentication**
   - Use Clerk's test mode for development
   - Create test users with different roles
   - Test the complete onboarding flow

2. **Database Inspection**
   - Use Convex Dashboard to inspect user records
   - Check that all onboarding data is being saved correctly

3. **Error Handling**
   - Check browser console for authentication errors
   - Monitor Convex function logs for sync issues

## Future Enhancements

- **Team Invitations**: Allow existing users to invite team members
- **Advanced Role Management**: More granular permissions system
- **Profile Updates**: Allow users to update their professional information
- **Admin Dashboard**: Administrative interface for user management 