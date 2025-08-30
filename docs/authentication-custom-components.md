# Custom Authentication Components Implementation

This document explains how to use custom authentication components instead of Clerk's default sign-in and sign-up components in the iAlex application.

## Overview

The application now uses custom authentication components that provide:
- **Custom UI/UX**: Tailored design matching the application's branding
- **Full Control**: Complete control over the authentication flow and user experience
- **Clerk Integration**: Still leverages Clerk's authentication backend for security
- **Consistent Styling**: Uses the application's design system and components

## Components

### 1. CustomSignIn Component

**Location**: `apps/application/src/components/Auth/CustomSignIn.tsx`

**Features**:
- Email and password authentication
- Password visibility toggle
- Loading states and error handling
- Responsive design
- Custom styling with Tailwind CSS

**Props**:
```typescript
interface CustomSignInProps {
  redirectUrl?: string;    // URL to redirect after successful sign-in
  onSuccess?: () => void;  // Callback function on successful sign-in
}
```

**Usage**:
```tsx
import { CustomSignIn } from "@/components/Auth/CustomSignIn";

<CustomSignIn 
  redirectUrl="/dashboard" 
  onSuccess={() => console.log("Signed in successfully")} 
/>
```

### 2. CustomSignUp Component

**Location**: `apps/application/src/components/Auth/CustomSignUp.tsx`

**Features**:
- First name, last name, email, and password fields
- Password confirmation with validation
- Email verification flow
- Password strength indicators
- Loading states and error handling
- Team-specific sign-up support

**Props**:
```typescript
interface CustomSignUpProps {
  redirectUrl?: string;    // URL to redirect after successful sign-up
  onSuccess?: () => void;  // Callback function on successful sign-up
  teamName?: string;       // Optional team name for team invitations
}
```

**Usage**:
```tsx
import { CustomSignUp } from "@/components/Auth/CustomSignUp";

<CustomSignUp 
  redirectUrl="/onboarding" 
  teamName="Legal Team Alpha"
  onSuccess={() => console.log("Account created successfully")} 
/>
```

## Authentication Flow

### Sign-In Flow
1. User enters email and password
2. Component validates input
3. Calls Clerk's `signIn.create()` method
4. Handles success/error responses
5. Redirects to specified URL or calls success callback

### Sign-Up Flow
1. User fills out registration form
2. Component validates all fields
3. Calls Clerk's `signUp.create()` method
4. If email verification is required:
   - Shows verification code input
   - User enters verification code
   - Calls `signUp.attemptEmailAddressVerification()`
5. On successful verification, redirects or calls success callback

## Error Handling

Both components include comprehensive error handling:

- **Validation Errors**: Client-side validation for required fields
- **Authentication Errors**: Server-side errors from Clerk API
- **Network Errors**: Connection and timeout issues
- **User-Friendly Messages**: Translated error messages in Spanish

## Styling and Theming

The components use:
- **Tailwind CSS**: For responsive design and styling
- **Shadcn/ui Components**: Button, Input, Card, Alert, etc.
- **Lucide Icons**: For visual elements
- **Consistent Branding**: Matches the iAlex application design

## Integration with Existing Code

### Updated Files

1. **SignInPage.tsx**: Now uses `CustomSignIn` instead of Clerk's `SignIn`
2. **SignupInvitePage.tsx**: Now uses `CustomSignUp` for team invitations
3. **SignUpPage.tsx**: New standalone sign-up page
4. **App.tsx**: Added route for `/signup`

### Backend Integration

The custom components still integrate with:
- **Clerk Authentication**: Uses Clerk's hooks and methods
- **Convex Database**: User data sync remains unchanged
- **Existing Auth Context**: No changes to authentication state management

## Security Considerations

- **Password Validation**: Minimum 8 characters required
- **Email Verification**: Required for new accounts
- **Clerk Backend**: All authentication still handled by Clerk's secure infrastructure
- **No Sensitive Data**: Passwords are never stored locally

## Customization

### Adding New Fields

To add additional fields to the sign-up form:

1. Add state variables for new fields
2. Add form inputs with validation
3. Include new fields in the `signUp.create()` call
4. Update the user sync logic in `OnboardingWrapper.tsx`

### Styling Changes

To modify the appearance:

1. Update Tailwind classes in the components
2. Modify the Card, Button, and Input components
3. Update the color scheme and spacing
4. Add custom CSS if needed

### Adding Social Login

To add social login options:

1. Import Clerk's social authentication methods
2. Add social login buttons to the components
3. Handle the OAuth flow callbacks
4. Update the success/error handling

### Google OAuth Integration

The components now include Google OAuth support:

**Sign-In with Google**:
```tsx
const handleGoogleSignIn = async () => {
  await signIn.authenticateWithRedirect({
    strategy: "oauth_google",
    redirectUrl: "/dashboard",
    redirectUrlComplete: "/dashboard",
  });
};
```

**Sign-Up with Google**:
```tsx
const handleGoogleSignUp = async () => {
  await signUp.authenticateWithRedirect({
    strategy: "oauth_google",
    redirectUrl: "/onboarding",
    redirectUrlComplete: "/onboarding",
  });
};
```

**Features**:
- ✅ Google OAuth buttons with proper styling
- ✅ Loading states during OAuth flow
- ✅ Error handling for OAuth failures
- ✅ Automatic redirect after successful authentication
- ✅ Consistent with email/password flow

## Testing

### Manual Testing Checklist

- [ ] Sign-in with valid credentials
- [ ] Sign-in with invalid credentials (error handling)
- [ ] Sign-in with Google OAuth
- [ ] Sign-up with valid information
- [ ] Sign-up with invalid information (validation)
- [ ] Sign-up with Google OAuth
- [ ] Email verification flow
- [ ] Password visibility toggle
- [ ] Responsive design on mobile/tablet
- [ ] Loading states during authentication
- [ ] Redirect functionality
- [ ] Team invitation sign-up flow

### Automated Testing

Consider adding tests for:
- Form validation
- Error handling
- Loading states
- Success flows
- Component rendering

## Troubleshooting

### Common Issues

1. **Clerk Not Loaded**: Ensure Clerk provider is properly configured
2. **Styling Issues**: Check Tailwind CSS configuration
3. **Redirect Problems**: Verify redirect URLs are correct
4. **Email Verification**: Check spam folder for verification codes

### Debug Mode

Enable debug logging by adding:
```typescript
console.log("Clerk loaded:", isLoaded);
console.log("Sign-in result:", result);
```

## Migration from Clerk Components

If you're migrating from Clerk's default components:

1. Replace `<SignIn />` with `<CustomSignIn />`
2. Replace `<SignUp />` with `<CustomSignUp />`
3. Update any custom appearance props
4. Test all authentication flows
5. Update any hardcoded references

## Future Enhancements

Potential improvements:
- **Multi-factor Authentication**: Add MFA support
- **Password Reset**: Implement forgot password flow
- **Social Login**: Add Google, GitHub, etc.
- **Remember Me**: Add persistent login option
- **Progressive Enhancement**: Add offline support
- **Accessibility**: Improve keyboard navigation and screen reader support

## Dependencies

Required dependencies:
- `@clerk/clerk-react`: For authentication hooks
- `@/components/ui/*`: Shadcn/ui components
- `lucide-react`: For icons
- `tailwindcss`: For styling

## Support

For issues or questions:
1. Check the Clerk documentation
2. Review the component source code
3. Test with different browsers/devices
4. Check the browser console for errors
