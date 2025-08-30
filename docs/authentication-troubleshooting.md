# Authentication Troubleshooting Guide

This guide helps resolve common issues with the custom authentication components.

## Common Issues

### 1. "Invalid verification strategy" Error

**Problem**: Users get "Invalid verification strategy" when trying to sign in.

**Cause**: This error occurs when:
- Clerk is configured to require email verification
- The authentication flow doesn't properly handle verification states
- Google OAuth is not properly configured

**Solutions**:

#### A. Enable Google OAuth (Recommended)
The custom components now include Google OAuth support. This bypasses email verification issues:

1. **Configure Google OAuth in Clerk Dashboard**:
   - Go to your Clerk Dashboard
   - Navigate to "User & Authentication" → "Social Connections"
   - Enable Google OAuth
   - Add your Google OAuth credentials

2. **Use Google Sign-In**:
   - Users can now click "Continuar con Google" button
   - This bypasses email verification requirements
   - Provides seamless authentication experience

#### B. Fix Email Verification Flow
If you prefer email/password authentication:

1. **Check Clerk Configuration**:
   - Go to Clerk Dashboard → "User & Authentication" → "Email, Phone, Username"
   - Ensure email verification is properly configured
   - Check if "Require email verification" is enabled

2. **Update Verification Settings**:
   - Consider disabling email verification for development
   - Or configure proper verification templates

#### C. Handle Verification States
The custom components now handle verification states:

```tsx
if (result.status === "needs_first_factor") {
  // Handle email verification
  setError("Please check your email for verification code");
}
```

### 2. Google OAuth Not Working

**Problem**: Google sign-in button doesn't work or shows errors.

**Solutions**:

1. **Check Clerk Configuration**:
   - Verify Google OAuth is enabled in Clerk Dashboard
   - Ensure OAuth credentials are correct
   - Check redirect URLs are properly configured

2. **Verify Environment Variables**:
   ```bash
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

3. **Check Browser Console**:
   - Look for OAuth-related errors
   - Verify no CORS issues

### 3. Component Not Loading

**Problem**: Authentication components show loading spinner indefinitely.

**Solutions**:

1. **Check Clerk Provider**:
   ```tsx
   <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
   ```

2. **Verify Environment Variables**:
   - Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set
   - Check the key is valid and active

3. **Check Network Requests**:
   - Open browser dev tools
   - Look for failed requests to Clerk API

### 4. Styling Issues

**Problem**: Components don't look right or are broken.

**Solutions**:

1. **Check Tailwind CSS**:
   - Ensure Tailwind is properly configured
   - Verify CSS is being loaded

2. **Check Component Imports**:
   ```tsx
   // Correct imports
   import { Button } from "../ui/button";
   import { Input } from "../ui/input";
   import { Alert, AlertDescription } from "../ui/alert";
   ```

3. **Verify Shadcn/ui Components**:
   - Ensure all UI components are installed
   - Check component versions are compatible

### 5. Redirect Issues

**Problem**: Users aren't redirected properly after authentication.

**Solutions**:

1. **Check Redirect URLs**:
   ```tsx
   <CustomSignIn redirectUrl="/dashboard" />
   <CustomSignUp redirectUrl="/onboarding" />
   ```

2. **Verify Route Configuration**:
   - Ensure target routes exist in your app
   - Check route permissions

3. **Handle OAuth Redirects**:
   ```tsx
   await signIn.authenticateWithRedirect({
     strategy: "oauth_google",
     redirectUrl: "/dashboard",
     redirectUrlComplete: "/dashboard",
   });
   ```

## Debug Mode

Enable debug logging to troubleshoot issues:

```tsx
// Add to components for debugging
console.log("Clerk loaded:", isLoaded);
console.log("Sign result:", result);
console.log("Error details:", err);
```

## Environment Setup

Ensure your environment is properly configured:

```bash
# .env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_CONVEX_URL=your_convex_url_here
```

## Testing Checklist

When troubleshooting, verify:

- [ ] Clerk Dashboard configuration
- [ ] Environment variables
- [ ] Network connectivity
- [ ] Browser console errors
- [ ] Component imports
- [ ] Route configuration
- [ ] OAuth provider setup

## Getting Help

If issues persist:

1. **Check Clerk Documentation**: https://clerk.com/docs
2. **Review Component Source**: Check the custom component code
3. **Browser Dev Tools**: Look for errors in console and network
4. **Test with Default Components**: Temporarily use Clerk's default components to isolate issues

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid verification strategy" | Email verification required | Use Google OAuth or configure verification |
| "Not authenticated" | Clerk not loaded | Check environment variables |
| "User not found in database" | User sync issue | Check Convex user sync |
| "OAuth error" | Google OAuth misconfigured | Verify OAuth settings in Clerk |
| "Redirect error" | Invalid redirect URL | Check route configuration |
