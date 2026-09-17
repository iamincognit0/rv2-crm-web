# RV2 CRM — Standalone Website

This is the standalone version of your CRM: business clients, pipeline,
services, follow-ups, agenda, collections, reports, and a separate
Business/Personal finance tracker (assets, liabilities, cash flow,
statements). It saves to a real Supabase database instead of Claude's
artifact storage, and is protected by email/password login.

## What you need (all free tiers)

1. A Supabase project (you already have a Supabase account)
2. A GitHub account (free) — to hold the code
3. A Vercel account (free) — to host the live site; sign up using your
   GitHub account for a one-click connection

## Step 1 — Set up Supabase

1. Go to supabase.com, log in, and click **New Project**.
   - Pick any name (e.g. "rv2-crm") and a database password (save it
     somewhere safe — you won't need it day-to-day, but keep it).
   - Pick the region closest to you.
2. Once the project finishes spinning up, go to the **SQL Editor** in the
   left sidebar, click **New query**, and paste in the entire contents of
   `supabase-schema.sql` (included in this project). Click **Run**.
   This creates the one table the app needs, with security rules so each
   logged-in user can only ever see their own data.
3. Go to **Project Settings → API** (left sidebar, gear icon).
   You'll need two values from this page in Step 3:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)
4. Go to **Authentication → Providers** and confirm **Email** is enabled
   (it is by default). Optionally, under **Authentication → Settings**,
   you can turn OFF "Confirm email" if you want to skip the email
   confirmation step while testing (turn it back on before real use).

## Step 2 — Push this code to GitHub

1. Go to github.com, sign in (or create a free account).
2. Click **New repository**. Name it e.g. `rv2-crm`. Keep it **Private**
   (recommended, since this holds business logic — though no actual data
   or secrets live in the code itself). Don't add a README/gitignore
   (this project already has them).
3. On your computer, open a terminal in this project folder and run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/rv2-crm.git
   git push -u origin main
   ```
   (Replace YOUR-USERNAME with your actual GitHub username. GitHub will
   show you this exact command on the empty repo's page too.)

## Step 3 — Deploy on Vercel

1. Go to vercel.com and sign in **with your GitHub account**.
2. Click **Add New → Project**, and select the `rv2-crm` repository you
   just pushed.
3. Vercel will auto-detect it's a Vite project — leave the build settings
   as default.
4. Before clicking Deploy, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL from Step 1
   - `VITE_SUPABASE_ANON_KEY` = your anon public key from Step 1
5. Click **Deploy**. After a minute or two, you'll get a live URL like
   `rv2-crm.vercel.app` — that's your permanent website.

## Step 4 — Create your login

1. Open your new live site.
2. Click **Sign up**, enter your email and a password.
3. If email confirmation is on, check your inbox and confirm, then log in.
4. You're in — start adding your real clients.

## Getting future updates live

Whenever a new version of the code is ready (after we make a change
together):
1. You'll get an updated set of files.
2. Replace the files in your local project folder with the new ones.
3. Run:
   ```
   git add .
   git commit -m "Update"
   git push
   ```
4. Vercel automatically redeploys within a minute or two — no dashboard
   clicking needed.

## Known limitation: the "Ask" tab

The in-app "Ask" assistant (natural-language questions about your data)
is currently disabled in this web version. It worked inside Claude's
artifact sandbox using a direct connection to Claude that doesn't exist
on a normal website. Re-enabling it here would need a small serverless
function (e.g. a Vercel Function) that safely holds an Anthropic API key
server-side and forwards requests — a separate, optional next step if
you want it.

## Running it locally (optional, for testing before deploying)

```
npm install
cp .env.example .env.local   # then fill in your real Supabase values
npm run dev
```
