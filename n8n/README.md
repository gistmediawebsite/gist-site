# n8n → gistmedia.org publishing

Any n8n workflow publishes a story by POSTing one JSON object to the **Publish webhook**. The workflow writes the article and image to GitHub, and GitHub Actions rebuilds and deploys the site. The story is live in 1–2 minutes.

## One-time setup (10 minutes)

1. **GitHub token:** GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Repository access: only `gist-site`. Permissions: **Contents: Read and write**.
2. **n8n credential 1:** Credentials → New → *GitHub API* → paste the token. Name it `GitHub account`.
3. **n8n credential 2:** Credentials → New → *Header Auth*. Name: `X-GIST-Key`. Value: a long random password. Name the credential `GIST publish key`.
4. **Import** `publish-article.workflow.json` (Workflows → Import from file).
5. In the node **Prepare article**, the repo is already set to `gistmediawebsite/gist-site`.
6. Open the 3 GitHub nodes and the webhook node, select the credentials above, then save and **activate**.
7. **Test:** send `sample-payload.json` (with a real `image_url`) to the webhook's production URL with header `X-GIST-Key: <your password>`. The reply is `{ ok: true, url: ... }`.

## Payload (the contract every agent must follow)

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Headline. Aim for 60–90 characters. |
| `description` | yes | 1–2 sentences. Also used as the Google snippet. |
| `body` | yes | Markdown. Use `##` for subheads. No H1. |
| `section` | yes | One of `celebrity`, `music`, `movies`, `sport`, `events`, `luxury`. |
| `image_url` | yes | A public URL to JPG, PNG or WebP under 4.5 MB. The image is copied into the site; the link is not hotlinked. |
| `image_alt` | recommended | Plain description of the image. |
| `image_credit` | recommended | e.g. `GIST`, or the rights holder. |
| `tags` | recommended | 3–6 people, events and places. |
| `sources` | recommended | `[{ "name": "...", "url": "..." }]`. Shown at the end of the story. |
| `slug` | optional | Defaults to the title. **Send the same slug again to update an existing story.** |
| `source`, `source_url` | optional | `instagram` / `linkedin` and the post link. Shows "First posted on Instagram". |
| `featured` | optional | `true` puts it at the top of the homepage. |
| `draft` | optional | `true` saves it to the site without showing it. |
| `date` | optional | ISO time. A future time schedules the story; the hourly rebuild publishes it. |
| `sponsored`, `sponsor`, `disclosure` | optional | Paid posts **must** set `sponsored: true`. |

To avoid duplicates, read `https://www.gistmedia.org/api/articles.json` (slugs, titles, tags, source URLs) before publishing.

## Social posts → website articles

**Recommended: fan-out at approval time.** When a post is approved in Telegram, the same n8n run posts to Instagram and LinkedIn **and** calls this webhook. One approval covers all three, and nothing has to be scraped back.

**Instagram posts made by hand:** add a Schedule trigger (every 30 minutes) → Facebook Graph API `GET /{ig-user-id}/media?fields=id,caption,media_url,permalink,timestamp`. Skip `permalink` values already present as `source_url` in `api/articles.json`. Then run the AI expander below and send to the webhook.

**Instagram stories:** `GET /{ig-user-id}/stories` returns only the last 24 hours. Poll at least every 6 hours and treat each story like a post.

**LinkedIn:** reading company-page posts through the API needs LinkedIn's Community Management API approval. Until GIST has it, use the fan-out method above for LinkedIn.

## AI expander prompt (caption → article)

Store this prompt in your prompts sheet so you can edit it.

> You turn a GIST social post into a web article. Use ONLY facts in the post and in the research brief provided. Never invent quotes, numbers, dates or sources. Voice: sharp, witty, intelligent sarcasm where it fits, never mocking anyone. Output JSON with: title (60–90 chars, catchy but accurate), description (≤160 chars), section, tags (3–6), body (Markdown, 250–500 words, ## subheads, short paragraphs, end with why it matters), sources (from the brief, with URLs), image_alt. If the facts are too thin for 250 words, return {"skip": true}.

Add an IF node after the expander: when `skip` is true, don't publish.
