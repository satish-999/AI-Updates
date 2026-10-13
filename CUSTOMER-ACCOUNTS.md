# Customer accounts — first release

Customers open /signup, choose a username and a 12–128 character password,
and save a one-time recovery code. Email and Google sign-in are not configured.
The old shared password and anonymous viewer cookies do not authenticate users.

Passwords use salted scrypt. Session and recovery tokens contain 256 random bits;
only hashes are stored. Recovery rotates its code, invalidates sessions and advances
the authentication version to prevent concurrent old-password session creation.
Losing both password and recovery code means self-service recovery is unavailable.

Accounts own read history and saved advisor projects. Project reads and deletes
are constrained to the authenticated account; submitted ownership IDs are ignored.
There is a 100-project account limit. Archive and story questions share 10 daily
attempts per account, in addition to the existing provider quota fuse. Archive
model generation is now an explicit POST, never a side effect of rendering GET.

The setup workflow applies only additive migration 007 with the existing repository
DATABASE_URL secret. It checks account isolation with uniquely named temporary
records and deletes those records. Existing news and legacy read history remain.
Vercel needs the same migrated DATABASE_URL and existing AUTH_SECRET for private
rate-limit fingerprints. APP_PASSWORD is no longer used by this branch.

Before inviting customers, confirm visitors can reach signup without a Vercel team
login. Preview protection is separate from app login. Payments, email verification,
social login, account deletion UI, automated alerts and policy pages remain future
work. This is an account pilot, not full commercial-launch readiness.
