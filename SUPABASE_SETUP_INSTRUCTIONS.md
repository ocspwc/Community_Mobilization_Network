# Supabase Setup Instructions

Your app now has Supabase integration! Follow these 3 steps to enable persistent storage:

## Step 1: Create the Supabase Table ⚠️ **REQUIRED**

**If you got error 42703 (column doesn't exist):**
Use `supabase_setup_fix.sql` instead - it will recreate the table cleanly.

**Otherwise, use:** `supabase_setup.sql`

1. Go to https://app.supabase.com
2. Select your project (`xkokabzojvuuwnntbxxs`)
3. Click **SQL Editor** in the left sidebar
4. Click **New query** button
5. Copy and paste **ALL** content from the appropriate `.sql` file
6. Click **Run** button (or press Cmd+Enter / Ctrl+Enter)
7. You should see: **"Success. No rows returned"** ✅

**IMPORTANT:** If you don't do this step, you'll get error 400!

## Step 2: Add Environment Variables to Render

1. Go to https://dashboard.render.com
2. Select your service
3. Click **Environment** tab
4. Add these **3** environment variables:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xkokabzojvuuwnntbxxs.supabase.co` |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrb2thYnpvanZ1dXdubnRieHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MDY2MTcsImV4cCI6MjA3NzQ4MjYxN30.jMy7J_tR-mu4NoIvpaHIbferJq7_SHuqt_8EuYQ1gFw` |
| `SUPABASE_TABLE` | `organization_overlays` |

5. Click **Save Changes**
6. Render will automatically redeploy

## Step 3: Verify It Works!

1. Wait for deployment to complete
2. Go to your app URL
3. Change an organization's status
4. Check Render logs - you should see: "Successfully saved to Supabase (status 200)"
5. Refresh the page - status should still be there! 🎉

## Troubleshooting

**If you see "Supabase PATCH failed":**
- Make sure you ran the SQL in Step 1
- Check the error message in logs
- Verify env vars are spelled correctly (no typos, no extra spaces)

**If changes don't persist:**
- Check Render logs for error messages
- In Supabase Table Editor, check if `state_data` is updating

**If you want to disable Supabase (use local file):**
- Simply delete the 3 env vars from Render
- App will automatically use `state.json` file

