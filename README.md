# Padre Wasson Foundation Organizer

A single-file web app (`index.html`) that turns notes, photos and documents into a complete content campaign:

- **WordPress blog post**: title, excerpt, H2 sections and a call to action, plus a featured image and a photo gallery
- **Social captions**: LinkedIn (professional, 3 hashtags), Facebook (warm, community), Google Business Profile (2 sentences), each with a suggested photo to download
- **Mailchimp newsletter**: subject line, preview text, body and button text, plus copy-ready HTML email in your brand colors with Mailchimp merge tags
- **German / English**: generate one language or both, switch with the DE/EN toggle, and add a missing language later with one click

Every output can be edited inline and copied.


## Running it

Open `index.html` in a browser, or serve the folder with any static web server. There is no build step, no account and no internet connection needed to generate a campaign. Tailwind CSS, fonts, and the PDF/Word readers load from CDNs when a file needs them.

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

Notes, files, generated outputs and settings are saved in this browser only (`localStorage` and IndexedDB). **Settings → Clear saved data** removes them.
