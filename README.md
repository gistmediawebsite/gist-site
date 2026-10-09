# gistmedia.org

The site is static. Articles are Markdown files in `content/articles/`. The roster and season come from `content/artists.json` and `content/experiences.json`, and site settings live in `content/settings.json`. `build.mjs` turns all of this into a complete, SEO-ready site in `dist/`. GitHub Actions deploys it to the existing Cloudflare Pages project **gist-media**, so gistmedia.org keeps working.

## Go live (about 30 minutes, once)

1. **GitHub:** create a repo named `gist-site`. Public is fine because nothing secret is in it, and public repos get unlimited free build minutes. Upload the contents of this folder, including the hidden `.github` folder.
2. **Cloudflare API token:** Cloudflare dashboard → My Profile → API Tokens → Create token → *Custom*. Permission: **Account → Cloudflare Pages → Edit**. Copy the token.
3. **Cloudflare account ID:** Workers & Pages → right-hand panel → Account ID.
4. **GitHub secrets:** repo → Settings → Secrets and variables → Actions → New secret. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
5. **First deploy:** repo → Actions → "Build & deploy gistmedia.org" → Run workflow. When it turns green, the new site is live on gistmedia.org.
6. **Editor:** in `admin/config.yml`, the repo is already set to `gistmediawebsite/gist-site`. Open `https://www.gistmedia.org/admin/` → *Sign In with Token* and paste a fine-grained GitHub token (Contents: read & write). You can then write, edit, schedule and unpublish stories, and edit settings and the artist roster.
7. **n8n:** follow `n8n/README.md`.

## After go-live

- **Search Console:** go to search.google.com/search-console, add `https://www.gistmedia.org`, choose the *HTML tag* method, and paste the code into Settings → *Search Console verification code*. Then submit `sitemap.xml` and `news-sitemap.xml`.
- **Bot blocking:** if Cloudflare is blocking crawlers, keep Googlebot allowed. The site's own `robots.txt` allows everything except `/admin/`.
- **Forms:** forms go to gaurav@gistmedia.org via FormSubmit. The first submission sends an activation email, so click *Activate* once. To route leads into n8n later, put the n8n webhook URL in Settings → *Form endpoint*.

## Edit locally (optional)

```
npm ci
npm run build
npm run preview
```

## Content rules the build enforces

- `draft: true` hides a story, and a future `date` schedules it (published by the hourly rebuild).
- Every story gets its own URL, NewsArticle schema, Open Graph tags, and entries in the sitemap, the Google News sitemap (last 48 hours) and RSS.
- `sponsored: true` adds a "Paid partnership" label on the story and on every card that links to it.
