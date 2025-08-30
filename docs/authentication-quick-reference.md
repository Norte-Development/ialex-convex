# Authentication Quick Reference

## Quick Start

### Replace Clerk Components

**Before (Clerk Components)**:
```tsx
import { SignIn, SignUp } from "@clerk/clerk-react";

<SignIn redirectUrl="/" />
<SignUp redirectUrl="/" />
```

**After (Custom Components)**:
```tsx
import { CustomSignIn, CustomSignUp } from "@/components/Auth";

<CustomSignIn redirectUrl="/" />
<CustomSignUp redirectUrl="/" />
```

## Component Props

### CustomSignIn
```tsx
<CustomSignIn 
  redirectUrl="/dashboard"     // Optional: redirect URL
  onSuccess={() => {}}         // Optional: success callback
/>
```

### CustomSignUp
```tsx
<CustomSignUp 
  redirectUrl="/onboarding"    // Optional: redirect URL
  onSuccess={() => {}}         // Optional: success callback
  teamName="Team Alpha"        // Optional: for team invitations
/>
```

## Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/signin` | `SignInPage` | General sign-in |
| `/signup` | `SignUpPage` | General sign-up |
| `/invites/signup` | `SignupInvitePage` | Team invitation sign-up |

## Features

### Sign-In Features
- ✅ Email/password authentication
- ✅ Google OAuth authentication
- ✅ Password visibility toggle
- ✅ Loading states
- ✅ Error handling
- ✅ Responsive design

### Sign-Up Features
- ✅ First name, last name, email, password
- ✅ Google OAuth registration
- ✅ Password confirmation
- ✅ Email verification
- ✅ Password strength indicator
- ✅ Team invitation support

## Error Messages

Common error messages (in Spanish):
- "Las contraseñas no coinciden" - Passwords don't match
- "La contraseña debe tener al menos 8 caracteres" - Password too short
- "Código de verificación inválido" - Invalid verification code
- "Error al crear la cuenta" - Account creation error

## Styling

The components use:
- **Tailwind CSS** for styling
- **Shadcn/ui** components
- **Lucide React** icons
- **Responsive design** for mobile/tablet

## Testing

Quick test checklist:
- [ ] Sign in with valid credentials
- [ ] Sign in with Google OAuth
- [ ] Sign up with valid information
- [ ] Sign up with Google OAuth
- [ ] Email verification flow
- [ ] Error handling with invalid data
- [ ] Mobile responsiveness
- [ ] Loading states

## Troubleshooting

### Common Issues

1. **Component not loading**: Check Clerk provider setup
2. **Styling broken**: Verify Tailwind CSS is configured
3. **Redirect not working**: Check redirect URL format
4. **Email verification**: Check spam folder

### Debug

Add console logs:
```tsx
console.log("Clerk loaded:", isLoaded);
console.log("Sign result:", result);
```

## Migration Checklist

When migrating from Clerk components:

- [ ] Replace `<SignIn />` with `<CustomSignIn />`
- [ ] Replace `<SignUp />` with `<CustomSignUp />`
- [ ] Update any appearance props
- [ ] Test all authentication flows
- [ ] Verify redirect URLs
- [ ] Check mobile responsiveness
- [ ] Test error scenarios
