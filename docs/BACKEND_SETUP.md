# Backend Setup Guide (Supabase)

This guide helps you set up the backend for your Fruit Management Mini Program using Supabase.

## 1. Create Supabase Project

1.  Go to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2.  Note down your `Project URL` and `anon public key` from Settings -> API.
3.  Update your frontend file `miniprogram/utils/supabase.ts` with these values.

## 2. Set Up Database Schema

1.  In the Supabase Dashboard, go to the **SQL Editor** (icon on let sidebar).
2.  Click "New Query".
3.  Copy the contents of `backend/db_schema.sql` and paste them into the query editor.
4.  Click **Run** to execute the script.
    -   This will create all necessary tables (`users`, `land_blocks`, `fertilizers`, `fruit_information`) and set up Row Level Security (RLS) policies.

## 3. Configure Storage

1.  In the Supabase Dashboard, go to **Storage**.
2.  Create a new bucket named `images`.
3.  Make sure it's public (or configure policies if private).
4.  (Optional) Add policies to allow authenticated users to upload files:
    -   `SELECT` (Read): Allowed for everyone or authenticated users.
    -   `INSERT` (Upload): Allowed for authenticated users (`auth.role() = 'authenticated'`).

## 4. Deploy Edge Functions

Your app uses Edge Functions for WeChat login and AI analysis.

1.  Install Supabase CLI locally if you haven't:
    ```bash
    brew install supabase/tap/supabase
    ```
2.  Login to Supabase CLI:
    ```bash
    supabase login
    ```
3.  Link your project locally (run this in `backend/` folder or root):
    ```bash
    supabase link --project-ref <your-project-id>
    ```
4.  Deploy the functions:
    ```bash
    supabase functions deploy wechat-login
    supabase functions deploy analyze-text
    ```
5.  Set Environment Variables for `wechat-login` function:
    -   Go to Supabase Dashboard -> Edge Functions -> `wechat-login` -> Secrets.
    -   Add `WECHAT_APP_ID`: Your WeChat Mini Program AppID.
    -   Add `WECHAT_APP_SECRET`: Your WeChat Mini Program AppSecret.
    -   Add `SUPABASE_URL`: Your Supabase Project URL.
    -   Add `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (from Settings -> API).

## 5. WeChat Login Detail

The provided `wechat-login` function is a scaffold. You need to ensure it correctly returns a valid Supabase Auth Token (JWT).
-   Currently it returns a stub `TODO_GENERATE_JWT`.
-   You may need to implement JWT signing using your project's JWT Secret, or use Supabase Auth Admin to generate a user session properly.
-   Alternatively, consider using a managed auth provider if available for WeChat, but custom function is standard for Mini Programs.

## 6. Analyze Text & Image AI

The `analyze-text` function is a placeholder.
-   To make it work with real AI, you need to call OpenAI or another API inside `backend/supabase/functions/analyze-text/index.ts`.
-   Add `OPENAI_API_KEY` to your function secrets if you modify it to use OpenAI.

---
**Done!** Your backend should now be ready to serve the Mini Program.
