# User Roles & Permissions Implementation Plan

## Overview

Add a role system (owner, admin, speaker, user) to the existing better-auth authentication system. Includes an admin dashboard for role management and seeded dev users.

## Current Architecture

- **Auth**: `better-auth` with Drizzle ORM + Cloudflare D1 (SQLite)
- **Backend**: Hono workers on Cloudflare Workers
- **Frontend**: React 19 + TanStack Router + Tailwind CSS 4
- **DB Schema**: `workers/auth-worker/src/db/schema.ts` — users, accounts, sessions, verifications tables
- **Shared types**: `packages/shared/src/types/index.ts`

## Implementation Plan

### Part 1: Add Role to Database & Auth

**1a. Add `role` column to the user schema**
- File: `workers/auth-worker/src/db/schema.ts`
- Add a `role` text column to the `users` table with a default of `"user"`
- Valid values: `"owner"`, `"admin"`, `"speaker"`, `"user"`

**1b. Generate a new Drizzle migration**
- Run `pnpm db:generate` from within `workers/auth-worker` to generate the SQL migration for the new column
- Run `pnpm db:migrate:local` to apply it locally

**1c. Add the `UserRole` type to shared types**
- File: `packages/shared/src/types/index.ts`
- Add `UserRole` type: `"owner" | "admin" | "speaker" | "user"`
- Add `role` field to the existing `User` interface

**1d. Configure better-auth to expose the role field**
- File: `workers/auth-worker/src/lib/auth.ts`
- Add `user.additionalFields` to the better-auth config so the `role` field is included in session responses
- This ensures `session.user.role` is available on the client

**1e. Update the auth client to include the role plugin**
- File: `apps/web/src/lib/auth-client.ts`
- Add the matching client-side plugin/inference so TypeScript knows about `session.user.role`

### Part 2: Admin Dashboard for Role Management

**2a. Create an admin API route on the auth worker**
- File: `workers/auth-worker/src/index.ts`
- Add endpoints:
  - `GET /api/admin/users` — list all users with their roles (requires owner/admin session)
  - `PATCH /api/admin/users/:id/role` — update a user's role (requires owner/admin session)
- Both endpoints validate the requesting user's session and check that they are owner or admin
- Owners can assign any role; admins can assign any role except owner

**2b. Create the admin dashboard route**
- File: `apps/web/src/routes/admin.tsx`
- New route at `/admin` showing:
  - A table of all users (name, email, role, created date)
  - A role dropdown/select for each user to change their role
  - Access restricted: if the logged-in user is not owner/admin, show an access denied message
- Uses the auth client session to check the current user's role client-side
- Calls the admin API endpoints for data fetching and mutations

**2c. Add navigation link to admin dashboard**
- File: `apps/web/src/routes/dashboard.tsx`
- Conditionally show an "Admin" link when the user's role is `owner` or `admin`

### Part 3: Seed Script for Local Development

**3a. Create a seed script**
- File: `workers/auth-worker/src/seed.ts`
- Creates 4 users via the better-auth sign-up API (or direct DB insert):
  - `owner@example.com` — role: `owner`, password: `password`
  - `admin@example.com` — role: `admin`, password: `password`
  - `speaker@example.com` — role: `speaker`, password: `password`
  - `user@example.com` — role: `user`, password: `password`
- All users have `name` set to their role capitalized (e.g., "Owner")

**3b. Add seed npm script**
- File: `workers/auth-worker/package.json`
- Add a `"db:seed"` script that runs the seed file against the local D1 database
- Also add to root `package.json` so `pnpm db:seed` works from the repo root

### Part 4: Tests

**4a. Add role-related tests**
- File: `workers/auth-worker/test/auth.test.ts` (extend existing)
- Test that newly signed-up users get default role `"user"`
- Test that the role field is returned in session data
- Test admin endpoint authorization (non-admin can't change roles)
- Test role update works for admin users

### Summary of Files to Create/Modify

| File | Action |
|------|--------|
| `workers/auth-worker/src/db/schema.ts` | Modify — add `role` column |
| `workers/auth-worker/drizzle/0001_*.sql` | Generated — new migration |
| `packages/shared/src/types/index.ts` | Modify — add `UserRole`, update `User` |
| `workers/auth-worker/src/lib/auth.ts` | Modify — expose `role` in better-auth |
| `apps/web/src/lib/auth-client.ts` | Modify — add role inference |
| `workers/auth-worker/src/index.ts` | Modify — add admin API endpoints |
| `apps/web/src/routes/admin.tsx` | **Create** — admin dashboard page |
| `apps/web/src/routes/dashboard.tsx` | Modify — add admin nav link |
| `workers/auth-worker/src/seed.ts` | **Create** — dev seed script |
| `workers/auth-worker/package.json` | Modify — add seed script |
| `package.json` | Modify — add seed script |
| `workers/auth-worker/test/auth.test.ts` | Modify — add role tests |
