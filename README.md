# Padre Wasson Foundation Organizer

A single-file web app (`index.html`) that turns notes, photos and documents into a complete content campaign:

- **WordPress blog post**: title, excerpt, H2 sections and a call to action, plus a featured image and a photo gallery
- **Social captions**: LinkedIn (professional, 3 hashtags), Facebook (warm, community), Google Business Profile (2 sentences), each with a suggested photo to download
- **Mailchimp newsletter**: subject line, preview text, body and button text, plus copy-ready HTML email in your brand colors with Mailchimp merge tags
- **German / English**: generate one language or both, switch with the DE/EN toggle, and add a missing language later with one click

Every output can be edited inline and copied.

**Interface language:** switch the whole app between English and German with the EN / DE buttons in the header (it starts in German on German browsers). This only changes the app's labels and messages; your notes and the generated campaign keep their own language.

**Reset:** the Reset button in the header clears notes, files, generated texts and WordPress details in one go. Colors, logo, organization details and the language setting stay.


## Running it

On Vercel the whole site sits behind an email sign-in (see below). Locally you can open `index.html` in a browser or serve the folder with any static web server; generating a campaign needs no account and no internet connection. Tailwind CSS, the fonts and the PDF/Word readers are served from `vendor/` on the same site (when opened as a local file, the PDF/Word readers fall back to a CDN).

## Sign-in (email code)

Only approved email addresses can open the Organizer:

1. Enter your email address on the sign-in page.
2. If the address is approved, you get an 8-character code by email (e.g. `K7PQ-M2XD`). It is valid for 10 minutes and only works in the browser that asked for it.
3. Type the code and you are in for 12 hours. The account menu (person icon, top right) shows who is signed in and has **Sign out** and **Sign out and remove my data from this device** (for shared computers).

Every page, script and API is locked until then. Only the sign-in page and the open-source libraries in `vendor/` load without signing in. See [SECURITY.md](SECURITY.md) for how it is protected.

### Setting it up on Vercel

Add these under **Project → Settings → Environment Variables**, mark the secrets as *Sensitive*, then redeploy:

| Variable | What it is |
| --- | --- |
| `AUTH_SECRET` | Random secret, at least 32 characters (`openssl rand -base64 48`). Signs codes and sessions. Changing it signs everyone out. |
| `ALLOWED_EMAILS` | Who may sign in, comma-separated. `@example.org` allows a whole domain. Removing an address locks it out immediately. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | A mailbox that sends the codes. Gmail: `smtp.gmail.com`, `465`, your address, an [app password](https://myaccount.google.com/apppasswords) (needs 2-Step Verification). IONOS: `smtp.ionos.de`, `465`. Port 587 uses STARTTLS; mail is never sent without encryption. |
| `RESEND_API_KEY` | Alternative to SMTP: a [Resend](https://resend.com) key (needs a verified sending domain). |
| `MAIL_FROM` | Sender address. Optional with SMTP (defaults to `SMTP_USER`), required with Resend. |
| `SESSION_HOURS` | Optional. How long a sign-in lasts (default 12, max 168). |
| `SESSION_VERSION` | Optional. Change the value (e.g. `1` → `2`) to sign everyone out at once. |
| `APP_URL` | Optional. The address shown in the email (defaults to the address the request came to). |

Without `AUTH_SECRET` the site stays locked. Without a way to send email, the sign-in page says sign-in is not set up yet.

## Photos & files

Drop anything into step 1: photos, PDFs, Word files (.docx), text files, videos, or whole folders. You can also pick many files at once or paste an image with Ctrl+V.

- **Selection:** every added file is selected automatically. Click a file to leave it out; the checkbox selects or clears all at once.
- **Featured image:** the first photo becomes the featured image. Click the star on another photo to change it.
- **Reading:** text is read from PDFs, Word and text files and used as source material.
- **Storage:** files are kept in the browser (IndexedDB), so they are still there after a reload.
- **Alt text:** each photo gets alt text derived from its file name, editable under "Alt text & captions" in the blog tab.

## Branding

In **Settings → Brand look**, upload the foundation's logo. The app shows it in the header and takes its main and accent colors from it automatically. It defaults to a blue-and-white theme until a logo is uploaded.

You can also pick a preset or enter exact hex codes. The colors are used throughout the app and in the exported newsletter HTML.

## How it writes the campaign

The app analyzes your notes and any attached documents (facts, figures, quotes, next steps, theme) entirely offline in the browser, and fills localized templates for German and English. It does not translate the facts themselves: German notes stay German inside English templates, and a notice says so.

## WordPress export

1. In WordPress, go to **Users → Profile → Application Passwords** (WordPress 5.6+) and create a password.
2. Enter the site URL, your username and that password in step 4, then click **Export**.

One click does everything:

- **Uploads:** all selected files go to the Media Library in parallel (up to 6 at a time), with a progress bar per file. Files already uploaded to that site are not uploaded again.
- **Drafts:** one draft per generated language, with the starred photo as the featured image and the other photos and videos as a gallery before the call to action.
- **Options:** status (draft, pending, private), format (Gutenberg blocks or classic HTML) and download links for documents.

The site must use HTTPS, and the user needs at least the Author role. If a security plugin or CORS policy blocks requests from the browser, **Copy as cURL** gives you equivalent terminal commands. The password is never stored.

## Data storage

Notes, files, generated outputs and settings are saved in this browser only (`localStorage` and IndexedDB), never on the server. **Settings → Clear saved data** or **Sign out and remove my data from this device** removes them.

## Development

```bash
npm install
npm test            # sign-in, session and middleware tests
npm run build       # checks the Content-Security-Policy, copies the public files to public/
npm run csp         # after editing the <script> in index.html: updates its hash in vercel.json
```

The page's inline script is allowed by its SHA-256 hash in `vercel.json`. If it changes without `npm run csp`, the Vercel build fails and the previous version stays online.
