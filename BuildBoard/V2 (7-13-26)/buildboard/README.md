# BuildBoard — Production

Church construction project management. Next.js on Vercel with Supabase for auth, database, and photo storage. Same stack as DeckQuote.

## Going live today — checklist

### 1. Create the Supabase project (~5 min)

1. Go to supabase.com → New project. Name it `buildboard`, pick a strong database password (save it somewhere — you rarely need it again), region **US East**.
2. When it finishes provisioning, open **SQL Editor**.
3. Open `supabase/schema.sql` from this repo. **Find the line marked `CHANGE ME` near the bottom** and replace `CHANGE-ME-2026` with your own team code (this is what your crew types to join — treat it like a gate code).
4. Paste the whole file into the SQL Editor and click **Run**. It should say "Success. No rows returned."
5. Go to **Authentication → Sign In / Up → Email** and turn **OFF** "Confirm email" if you want your crew signing in immediately without clicking an email link. (Leave it on if you prefer verified emails — signup then requires one email click.)
6. Go to **Project Settings → API** and copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key

### 2. Push this repo to GitHub (~5 min)

Create a new GitHub repo named `buildboard` and push this folder to it (same flow you used for DeckQuote). The `.gitignore` already excludes `node_modules` and env files.

### 3. Deploy on Vercel (~5 min)

1. Vercel → **Add New → Project** → import the `buildboard` repo.
2. Framework is auto-detected as Next.js. Before deploying, add two **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
3. Deploy. You'll get a URL like `buildboard-xyz.vercel.app`.

### 4. First sign-in

1. Open the URL, tap **Join the team**, enter your name, email, password, and your team code.
2. **The first account created becomes the admin automatically.** Create yours before sharing the link.
3. Share the app URL + team code with your crew. Everyone who joins starts as a Member — promote leads under **Team → Edit**.

### 5. Install to home screens

On Android (your Fold and most of the crew): open the URL in Chrome → menu (⋮) → **Add to Home screen** → **Install**. It runs full-screen like a native app. On iPhone: Safari → Share → **Add to Home Screen**.

## What's enforced where

Permissions are enforced by **Postgres Row-Level Security**, not just hidden buttons. Even someone poking at the API directly can only do what their role allows. The permission toggles under Team → Role permissions write to the `role_permissions` table and take effect immediately for everyone.

Guard rails in the database:
- Members editing their own task can only change **status and notes** (trigger-enforced).
- Only team managers can change anyone's **role** (trigger-enforced — no self-promotion).
- Signup requires the current **team code** (checked server-side, can't be bypassed).

## Feature notes

- **Offline**: the app installs as a PWA and shows your last-synced data when signal drops. Edits require a connection — you'll see "Offline — not saved" rather than silent data loss.
- **Photos**: task photos are downscaled on the phone before upload (fast even on one bar), stored in the `task-photos` Supabase Storage bucket. The bucket is public-read via unguessable URLs — fine for job-site photos; don't put sensitive documents there.
- **Cost sheet → PDF**: open any cost analysis → **Print / Save PDF**. On Android the print dialog has "Save as PDF" — clean output for the church board, no app chrome.
- **Task dependencies**: set "Waiting on" in any task. The task list shows a red "waiting on" band until the blocking task is Done.
- **Activity**: every create/update/status change is logged with who did it. Live-updates via Supabase Realtime — leave the Tasks page open and you'll see teammates' changes appear without refreshing.

## Costs

Supabase free tier: 500MB database + 1GB storage — years of headroom for a church team. Vercel free tier covers this easily. $0/month until you're far bigger than one congregation.

## Changing the team code later

SQL Editor → `update app_settings set team_code = 'NEW-CODE' where id = 1;`
Existing accounts keep working; only new signups need the new code.

## Local development

```bash
cp .env.local.example .env.local   # fill in your two Supabase values
npm install
npm run dev
```
