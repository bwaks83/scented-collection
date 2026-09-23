# Scent Company — Google Sheets and email

Responses spreadsheet: https://docs.google.com/spreadsheets/d/1Rd-bbKTOLCommqZSFdJ2GxaEo1xXeWjwxZmL_7hnF-M/edit
Notifications: b.alves@scentcompanyusa.com

## Google Apps Script (one-time setup)

1. Sign in to the Google account that can edit the spreadsheet and open https://script.google.com/home.
2. Create a project named **Scent Company — Inquiry Receiver**.
3. Replace Code.gs with `google-apps-script/Code.gs` from this repository.
4. Select `setup` and run it. Review and authorize spreadsheet access, sending email, and the scheduled email retry. This does not send a test email.
5. In Project Settings → Script properties, copy the generated `INQUIRY_SECRET`. Do not put it in GitHub or HTML.
6. Deploy → New deployment → Web app. Execute as yourself; access: Anyone. Requests are authenticated by the secret; the spreadsheet stays private. Copy the URL ending in `/exec`.

## Vercel

1. Open the scented-collection project's Settings → Environment Variables.
2. Add `GOOGLE_APPS_SCRIPT_URL` with the `/exec` URL and `INQUIRY_SECRET` with the secret from Google. Configure Production (and Preview only if needed).
3. Redeploy the latest commit. The project uses the root directory with index.html and api/inquiry.js. No framework/build command is required.
4. GET `/api/inquiry` should return `{"ready":true}`. This checks configuration presence, not Google authorization.
5. Submit a clearly labeled test inquiry, verify a row in Responses and an email to the configured recipient. Retry the same request to check that only one row exists.

Until the variables are configured, the form keeps the download-only preview mode and does not claim that answers were sent.

## Delivery behavior

Vercel validates the request and sends it to Apps Script using a server-only secret. Google saves the response before attempting email. Failed emails remain Pending and retry every 10 minutes. A repeated submission ID with the same fingerprint reuses the existing row; a different payload with that ID is rejected. An ambiguous mail send failure can still result in a duplicate notification; response rows remain deduplicated.

Run local checks with `node --test test/*.test.js`. No live email is sent by these tests.
