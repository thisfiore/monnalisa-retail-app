# Screenshots for the public staff guide (`/guida`)

These images are served on a **publicly reachable** page, so they must never
show real customer or account data. When you replace or add one, keep the same
rules:

**Capture**
- Desktop viewport 1456×832, so every shot lines up on the guide page.
- Use the purpose-made demo record only: **Giulia Bianchi**,
  `giulia.bianchi.demo@yopmail.com`, `+39 338 7745219`, child *Emma*.
  It lives in the staging CRM (store Arezzo).
- Never screenshot a search whose results include other records — staging holds
  realistic-looking names and personal email addresses. Search by
  `bianchi.demo` to isolate the demo record; use
  `aurora.belmonte@example.com` for the "no results" state.

**Redact before committing**
- The store account email (`storemanager1@monnalisa.com`) appears in the app
  header and in the Store card. In the shots below it was painted out with
  ImageMagick:
  ```sh
  # header (black bar — a black fill is invisible)
  magick in.jpg -fill black -draw "rectangle 1044,36 1264,58" -quality 88 out.jpg

  # Store card "Sales Associate" value (white card — replace with a role label)
  magick in.jpg -fill white -draw "rectangle 728,589 952,613" \
    -font Helvetica-Bold -pointsize 15 -fill '#111827' \
    -annotate +731+608 'Store Manager' -quality 88 out.jpg
  ```
- The Salesforce Store ID is left visible: it is an internal record id, not a
  credential. Paint it out too if that changes.

The captions and alt text that go with each image live in
`src/pages/Guide.content.ts`.
