FINDORA — SHARED DATABASE VERSION

This version connects the website to Supabase. After setup, all visitors to the same deployed site read and update the same report records. Realtime updates refresh open pages when the database changes.

FILES
- index.html
- style.css
- script.js
- supabase-config.js
- supabase-setup.sql

SETUP
1. Create a Supabase project at https://supabase.com/.
2. In the project dashboard, open SQL Editor > New query.
3. Open supabase-setup.sql, copy all its SQL, paste it into SQL Editor, and run it.
4. In Supabase Project Settings > API (or API Keys), copy the Project URL and anon/publishable key.
5. Open supabase-config.js and replace the two PASTE_YOUR... values.
   Do NOT put a service_role or secret key in this file.
6. Save all files.
7. Deploy the entire folder to Netlify again (or upload the folder using Netlify Drop).
8. Open the published site in two separate browsers/devices. Submit a test report in one; it should appear in the other. Change its type/status in the management panel; it should update in both.

IMPORTANT SECURITY LIMITATION
The supplied SQL is a classroom/demo setup. It allows anyone with the public site to submit and update reports, including changing item status. The public anon key is designed to be used in browser apps, but database policies control what it can do. Never use a service_role/secret key in frontend code.

For actual school deployment:
- Add Supabase Auth.
- Require staff sign-in for changing report type/status.
- Keep student contact information private; do not show it in public item detail views.
- Consider a private staff-only contact table and secure image storage.
- Have the school approve the privacy and data-handling design.

IMAGE NOTE
For simplicity, this prototype stores small uploaded pictures as data URLs in the database. Keep images below 700 KB. A production system should use Supabase Storage instead.

If a report doesn't load, look at the red setup message near "Recently Reported Items" and check the browser console.
