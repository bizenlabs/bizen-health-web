# Welcome to Bizen Labs — Email Verification Template

> **Where this lives:** This email is **not** in the codebase. Invitation/verification
> emails are templated and sent by **WorkOS**. To change it, edit the template in the
> **WorkOS Dashboard → Authentication → Emails → "Email verification"** template.
>
> **Send flow (for reference):**
> `settings/staff` → `lib/users.ts:inviteTenantUser()` → backend `TenantUsersAdminController`
> → `WorkOsRestMemberships` → WorkOS `/user_management/invitations` → WorkOS renders & sends.

## Notes before pasting

1. **Merge tags** — `{{code}}` and `{{email}}` are placeholders. Confirm the exact
   variable names shown next to the WorkOS template editor and swap if needed.
2. **Naming** — Code uses both `bizenlabs` (Java pkg `com.bizenlabs`) and `bizenhealth`
   (product, `api.bizenhealth.com`). Copy below uses "Bizen Labs."
3. **Template type** — Edit the **email verification** (code-based) template, not the
   **invitation** (link-based) one.

## Subject

```
Welcome to Bizen Labs — confirm your email to get started
```

## HTML body

```html
<div
  style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;"
>
  <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 8px;">
    Welcome to Bizen Labs 👋
  </h1>

  <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 24px;">
    We're glad you're here. Bizen Labs helps your clinic run smoother — patient
    visits, encounters, and records, all in one place.
  </p>

  <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px;">
    To finish setting up your account, enter the code below in the browser
    window you just opened:
  </p>

  <div
    style="font-size: 30px; font-weight: 700; letter-spacing: 6px; text-align: center; background: #f4f5f7; border-radius: 10px; padding: 18px 0; margin: 0 0 24px; color: #111;"
  >
    {{code}}
  </div>

  <p style="font-size: 13px; line-height: 1.6; color: #888; margin: 0 0 8px;">
    This code confirms <strong>{{email}}</strong>. If you didn't request access
    to Bizen Labs, you can safely ignore this email.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />

  <p style="font-size: 12px; color: #aaa; margin: 0;">
    Bizen Labs · Better care, less paperwork
  </p>
</div>
```

## Plain-text fallback

```
Welcome to Bizen Labs

We're glad you're here. To finish setting up your account, enter this
code in the browser window you just opened:

    {{code}}

This code confirms {{email}}. If you didn't request access to Bizen
Labs, you can safely ignore this email.

— Bizen Labs · Better care, less paperwork
```
