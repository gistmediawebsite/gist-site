// GIST website builder. Reads /content, writes a complete static site to /dist.
// Run: npm run build   (Node 18+)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";
import { marked } from "marked";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const C = (p) => path.join(ROOT, "content", p);
const OUT = path.join(ROOT, "dist");
const S = JSON.parse(fs.readFileSync(C("settings.json"), "utf8"));
const TALENT = JSON.parse(fs.readFileSync(C("artists.json"), "utf8"));
const ACCESS = JSON.parse(fs.readFileSync(C("experiences.json"), "utf8"));
const SITE = S.siteUrl.replace(/\/$/, "");
const NOW = new Date();
fs.rmSync(OUT, { recursive: true, force: true });

/* ---------------- helpers ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
const copyDir = (from, to) => { if (!fs.existsSync(from)) return; fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name), b = path.join(to, e.name); e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b); } };
const IST = (d) => { const x = new Date(new Date(d).getTime() + 5.5 * 3600e3); return x; };
const fmtDate = (d) => IST(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtTime = (d) => IST(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " IST";
const iso = (d) => new Date(d).toISOString();
const wa = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
const sectionLabel = (id) => (S.sections.find((s) => s.id === id) || {}).label || id;
const ARROW = '<span class="arr" aria-hidden="true">→</span>';
const ICON = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 2a7 7 0 1 1-3.6 13l-.3-.2-2.2.6.6-2.1-.2-.3A7 7 0 0 1 12 5Zm-3 3.5c-.3 0-.7.4-.7 1.2s.7 2.2 2.3 3.6 3 1.9 3.6 1.9 1.3-.5 1.4-1-.1-.6-.3-.7l-1.4-.7c-.2-.1-.4 0-.5.1l-.5.6c-.1.2-.3.2-.5.1-.6-.3-1.9-1.2-2.3-2.2 0-.2 0-.3.1-.4l.4-.5c.1-.2.1-.3 0-.5l-.6-1.4c-.1-.2-.3-.3-.5-.3H9Z"/></svg>',
  li: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h3v10H5zM6.5 4.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM10.5 9h2.9v1.4c.5-.9 1.6-1.7 3.2-1.7 3 0 3.4 2 3.4 4.4V19h-3v-5.2c0-1.2 0-2.6-1.6-2.6s-1.9 1.2-1.9 2.5V19h-3z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h4.5l11.5 16h-4.5z"/><path d="M4 20 10.6 13M20 4l-6.4 7" stroke="currentColor" stroke-width="2"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>',
};

/* ---------------- images ---------------- */
// Reads WebP/PNG/JPEG dimensions so every <img> gets width/height (no layout shift).
function imageSize(file) {
  try {
    const b = fs.readFileSync(file);
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const t = b.toString("ascii", 12, 16);
      if (t === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (t === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (t === "VP8L") { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
    }
    if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b[0] === 0xff && b[1] === 0xd8) { let i = 2; while (i < b.length) { const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + len; } }
  } catch {}
  return null;
}
const STATIC = path.join(ROOT, "static");
function img(src, o = {}) {
  if (!src) return "";
  if (!src.startsWith("/")) src = "/img/" + src.replace(/^img\//, "") + (/\.\w+$/.test(src) ? "" : ".webp");
  const local = path.join(STATIC, src);
  const dim = imageSize(local) || [1280, 853];
  const small = src.replace(/(\.\w+)$/, "-sm$1");
  const hasSmall = fs.existsSync(path.join(STATIC, small));
  const srcset = hasSmall ? ` srcset="${small} 720w, ${src} ${dim[0]}w" sizes="${o.sizes || "(max-width: 700px) 100vw, 50vw"}"` : "";
  return `<div class="ph${o.ratio ? " r-" + o.ratio : ""}"><img src="${hasSmall && !o.eager ? small : src}"${srcset} width="${dim[0]}" height="${dim[1]}" alt="${esc(o.alt || "")}" ${o.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`;
}

/* ---------------- articles ---------------- */
function parseArticle(file) {
  const raw = fs.readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("Missing front matter in " + file);
  const fm = yaml.load(m[1]) || {};
  const slug = slugify(fm.slug || path.basename(file, ".md"));
  if (!fm.title) throw new Error("Missing title in " + file);
  const body = m[2].trim();
  const words = body.split(/\s+/).length;
  return {
    ...fm, slug, body, html: marked.parse(body),
    date: fm.date ? new Date(fm.date) : NOW,
    updated: fm.updated ? new Date(fm.updated) : (fm.date ? new Date(fm.date) : NOW),
    section: fm.section || "events", author: fm.author || S.defaultAuthor,
    description: fm.description || body.replace(/[#*_>\[\]()]/g, "").slice(0, 155),
    read: Math.max(1, Math.round(words / 220)), url: `/news/${slug}/`,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    sources: Array.isArray(fm.sources) ? fm.sources : [],
  };
}
const ARTICLES = fs.readdirSync(C("articles")).filter((f) => f.endsWith(".md"))
  .map((f) => parseArticle(C("articles/" + f)))
  .filter((a) => !a.draft && a.date <= new Date(NOW.getTime() + 60e3))   // drafts and future posts stay hidden
  .sort((a, b) => b.date - a.date);

/* ---------------- layout ---------------- */
const cssHash = crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, "src/site.css"))).update(fs.readFileSync(path.join(ROOT, "src/extra.css"))).digest("hex").slice(0, 8);
const jsHash = crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, "src/site.js"))).digest("hex").slice(0, 8);
const ORG_LD = { "@type": "NewsMediaOrganization", "@id": SITE + "/#org", name: S.siteName, url: SITE + "/", logo: { "@type": "ImageObject", url: SITE + "/logo-512.png" }, email: S.email, sameAs: [S.instagram, S.linkedin, S.facebook].filter(Boolean), publishingPrinciples: SITE + "/editorial-policy/", correctionsPolicy: SITE + "/editorial-policy/#corrections", parentOrganization: S.publisher ? { "@type": "Organization", name: S.publisher } : undefined };
const NAV = [["/news/", "What's Happening", "news"], ["/artist-booking/", "Artist Booking", "artists"], ["/experiences/", "Experiences", "experiences"]];

function layout({ title, description, path: p, body, nav, ld = [], ogImage, ogType = "website", noindex, waText, extraHead = "" }) {
  const url = SITE + p;
  const fullTitle = title ? `${title} | ${S.siteName}` : `${S.siteName} — ${S.tagline}`;
  const og = ogImage ? SITE + ogImage : SITE + "/og-default.png";
  const graph = { "@context": "https://schema.org", "@graph": [ORG_LD, { "@type": "WebSite", "@id": SITE + "/#site", url: SITE + "/", name: S.siteName, inLanguage: "en-IN", publisher: { "@id": SITE + "/#org" } }, ...ld] };
  const ga = S.ga4Id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(S.ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${esc(S.ga4Id)}");</script>` : "";
  const ticker = ARTICLES.slice(0, 6).map((a) => `<a href="${a.url}"><span>${esc(sectionLabel(a.section))}</span>${esc(a.title)}</a>`).join("");
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || S.description)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">'}
<meta property="og:site_name" content="${esc(S.siteName)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title || fullTitle)}">
<meta property="og:description" content="${esc(description || S.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#121211">
${S.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(S.googleSiteVerification)}">` : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${esc(S.siteName)}" href="${SITE}/news/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${cssHash}">
${extraHead}
<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>
${ga}
</head>
<body data-form-endpoint="${esc(S.formEndpoint)}" data-email="${esc(S.email)}">
<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <div class="wrap">
    <span class="tag left">Celebrity · Music · Movies · Sport<br>India and the world</span>
    <a class="wordmark" href="/" aria-label="GIST MEDIA home"><span class="w" aria-hidden="true">GIST<span class="dot"></span></span><span class="m" aria-hidden="true">MEDIA</span></a>
    <div class="right"><span class="tag center" style="text-align:right">${esc(S.tagline).replace(". ", ".<br>")}</span></div>
  </div>
</header>
<div class="navbar">
  <div class="wrap">
    <a class="mini" href="/" aria-label="GIST home">GIST<i aria-hidden="true"></i></a>
    <nav aria-label="Main" style="flex:1;min-width:0">
      <ul class="nav">${NAV.map(([h, l, k]) => `<li><a href="${h}"${nav === k ? ' aria-current="page"' : ""}>${l}</a></li>`).join("")}</ul>
    </nav>
    <div class="tools">
      <a class="iconbtn wa-top" href="${wa(waText || "Hi GIST, I found you on gistmedia.org.")}" target="_blank" rel="noopener" data-wa aria-label="Chat with GIST on WhatsApp">${ICON.wa}</a>
    </div>
  </div>
</div>
${ticker ? `<div class="ticker" role="region" aria-label="Latest headlines"><div class="wrap row"><span class="lab">Just in</span><div class="clip"><div class="track">${ticker}${ticker}</div></div></div></div>` : ""}
<main id="main" tabindex="-1">
${body}
</main>
<footer class="footer on-band">
  <div class="wrap">
    <div class="cols">
      <div><p class="about">GIST covers what everyone's talking about in entertainment, celebrity, live music and sport, from India and around the world. GIST Talent books artists for weddings, private and corporate stages. GIST Access arranges private access to the world's marquee events.</p>
        <p class="foot-contact"><a href="mailto:${esc(S.email)}">${esc(S.email)}</a><br><a href="${wa("Hi GIST")}" target="_blank" rel="noopener" data-wa>WhatsApp ${esc(S.whatsappDisplay)}</a></p></div>
      <div><h4>Read</h4><ul><li><a href="/news/">What's Happening</a></li>${S.sections.map((s) => `<li><a href="/news/${s.id}/">${esc(s.label)}</a></li>`).join("")}</ul></div>
      <div><h4>Book</h4><ul><li><a href="/artist-booking/">Artist Booking</a></li><li><a href="/experiences/">Experiences</a></li><li><a href="/contact/">Contact</a></li></ul></div>
      <div><h4>Follow</h4><ul>${S.instagram ? `<li><a href="${esc(S.instagram)}" rel="noopener" target="_blank">Instagram ${esc(S.instagramHandle)}</a></li>` : ""}${S.linkedin ? `<li><a href="${esc(S.linkedin)}" rel="noopener" target="_blank">LinkedIn</a></li>` : ""}${S.facebook ? `<li><a href="${esc(S.facebook)}" rel="noopener" target="_blank">Facebook</a></li>` : ""}<li><a href="/news/rss.xml">RSS</a></li></ul></div>
    </div>
    <nav class="corp" aria-label="Company"><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/editorial-policy/">Editorial policy</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/grievance/">Grievance redressal</a></nav>
    <div class="huge" aria-hidden="true">GIST<i></i></div>
    <div class="base"><span>© ${NOW.getFullYear()} ${esc(S.siteName)}${S.publisher ? " · Operated by " + esc(S.publisher) : ""}</span><span>Illustrative photography: Pixabay contributors, Pixabay Content License, unless credited otherwise</span></div>
  </div>
</footer>
<a class="wa-float" href="${wa(waText || "Hi GIST, I found you on gistmedia.org.")}" target="_blank" rel="noopener" data-wa aria-label="Chat with GIST on WhatsApp">${ICON.wa}<span>Chat</span></a>
<script src="/assets/site.js?v=${jsHash}" defer></script>
</body>
</html>`;
}

/* ---------------- shared blocks ---------------- */
const label = (a) => a.sponsored ? `<span class="label sponsored">Paid partnership</span>` : `<span class="label">${esc(sectionLabel(a.section))}</span>`;
function storyCard(a, o = {}) {
  return `<a class="card hoverzoom${o.big ? " big" : ""}${o.cls ? " " + o.cls : ""}" href="${a.url}">
    ${img(a.image, { ratio: o.ratio || "32", alt: a.image_alt, sizes: o.sizes || "(max-width: 620px) 100vw, (max-width: 980px) 50vw, 33vw" })}
    ${label(a)}<h3>${esc(a.title)}</h3>${o.noDek ? "" : `<p>${esc(a.description)}</p>`}
    <span class="meta">${esc(fmtDate(a.date))} · ${a.read} min read</span></a>`;
}
function newsGrid(list) {
  const pattern = [{ cls: "g-6", big: true, ratio: "43" }, { cls: "g-3", ratio: "45" }, { cls: "g-3", ratio: "45" }];
  return `<div class="newsgrid">${list.map((a, i) => storyCard(a, pattern[i % 9] || { cls: "g-3" })).join("")}</div>`;
}
const crumbs = (items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([h, l], i) => i === items.length - 1 ? `<span aria-current="page">${esc(l)}</span>` : `<a href="${h}">${esc(l)}</a><span>/</span>`).join("")}</nav>`;
const crumbLd = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([h, l], i) => ({ "@type": "ListItem", position: i + 1, name: l, item: SITE + h })) });
function field(id, lab, control, hint) {
  return `<div class="field"><label for="${id}">${esc(lab)}</label>${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
}
function talentForm(pre) {
  const opts = TALENT.artists.map((a) => `<option${pre === a.slug ? " selected" : ""}>${esc(a.name)}</option>`).join("");
  return `<div class="formbox" id="enquire"><div class="two" style="gap:28px">
    <div style="display:grid;gap:14px;align-content:start"><h2>Hold a date</h2><p class="muted">Share the date, city and occasion. We come back with options, live availability and a net quote.</p>
      <ul class="bullets"><li>Nothing is confirmed until an agreement is signed and the advance is released.</li><li>Quotes exclude travel, stay, production and taxes unless stated.</li></ul>
      <p><a class="btn ghost" href="${wa(pre ? `Hi GIST, I'd like to check availability for ${(TALENT.artists.find((a) => a.slug === pre) || {}).name}.` : "Hi GIST, I'd like to book an artist.")}" target="_blank" rel="noopener" data-wa>Or ask on WhatsApp</a></p></div>
    <form class="form" data-form="Artist booking" novalidate>
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="grid2">${field("t-name", "Name", `<input id="t-name" name="name" required autocomplete="name">`)}${field("t-phone", "Phone / WhatsApp", `<input id="t-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+91">`)}</div>
      ${field("t-email", "Email", `<input id="t-email" name="email" type="email" required autocomplete="email">`)}
      ${field("t-artist", "Artist", `<select id="t-artist" name="artist" required><option value="">Choose an artist</option>${opts}<option>Not sure — suggest options</option></select>`)}
      <div class="grid2">${field("t-occasion", "Occasion", `<select id="t-occasion" name="occasion" required><option value="">Choose</option>${["Wedding", "Sangeet / mehendi", "Private celebration", "Corporate", "Brand / IP", "Other"].map((x) => `<option>${x}</option>`).join("")}</select>`)}${field("t-date", "Date", `<input id="t-date" name="date" type="date" required>`)}</div>
      <div class="grid2">${field("t-city", "City / venue", `<input id="t-city" name="city" required>`)}${field("t-aud", "Audience size", `<select id="t-aud" name="audience"><option>Under 100</option><option>100–300</option><option>300–1,000</option><option>1,000+</option></select>`)}</div>
      ${field("t-notes", "Budget and anything else", `<textarea id="t-notes" name="notes" maxlength="1500"></textarea>`, "Optional")}
      <div><button class="btn" type="submit">Send booking enquiry ${ARROW}</button></div>
      <div class="status" role="status" aria-live="polite" hidden></div>
    </form></div></div>`;
}
function accessForm(pre) {
  const opts = ACCESS.experiences.map((x) => `<option${pre === x.slug ? " selected" : ""}>${esc(x.name)}</option>`).join("");
  return `<div class="formbox" id="enquire"><div class="two" style="gap:28px">
    <div style="display:grid;gap:14px;align-content:start"><h2>Hold a place</h2><p class="muted">Share the event, dates and number of guests. We return options with availability within a day, and pricing in writing before you pay anything.</p>
      <p><a class="btn ghost" href="${wa(pre ? `Hi GIST, I'm interested in ${(ACCESS.experiences.find((x) => x.slug === pre) || {}).name}.` : "Hi GIST, I'm interested in an experience.")}" target="_blank" rel="noopener" data-wa>Or ask on WhatsApp</a></p></div>
    <form class="form" data-form="Experience enquiry" novalidate>
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="grid2">${field("x-name", "Name", `<input id="x-name" name="name" required autocomplete="name">`)}${field("x-phone", "Phone / WhatsApp", `<input id="x-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+91">`)}</div>
      ${field("x-email", "Email", `<input id="x-email" name="email" type="email" required autocomplete="email">`)}
      ${field("x-event", "Experience", `<select id="x-event" name="experience" required><option value="">Choose</option>${opts}<option>Something else</option></select>`)}
      <div class="grid2">${field("x-guests", "Guests", `<input id="x-guests" name="guests" type="number" min="1" max="200" value="2" required>`)}${field("x-from", "Travelling from", `<input id="x-from" name="from" placeholder="e.g. Mumbai">`)}</div>
      ${field("x-notes", "Preferences", `<textarea id="x-notes" name="notes" maxlength="1500"></textarea>`, "Optional")}
      <div><button class="btn" type="submit">Send enquiry ${ARROW}</button></div>
      <div class="status" role="status" aria-live="polite" hidden></div>
    </form></div></div>`;
}
const steps = (list) => `<ol class="steps">${list.map(([t, d]) => `<li><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`).join("")}</ol>`;
function artistCard(a) {
  return `<a class="acard${a.featured ? " feat" : ""}" href="/artist-booking/${a.slug}/"><span class="tier">${esc(a.tier)}</span><h3>${esc(a.name)}</h3><p>${esc(a.role || a.line)}</p></a>`;
}
function expCard(x) {
  return `<a class="xcard hoverzoom" href="/experiences/${x.slug}/">${img(x.image, { alt: "", sizes: "(max-width: 520px) 100vw, (max-width: 980px) 50vw, 25vw" })}<span class="cat">${esc(x.category)}</span><div class="txt"><span class="where">${esc(x.when)}</span><h3>${esc(x.name)}</h3><span class="from">${esc(x.price)}</span></div></a>`;
}
function table(t) {
  return `<div class="tbl-wrap"><table class="tbl">${t.caption ? `<caption>${esc(t.caption)}</caption>` : ""}<thead><tr>${t.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/* ---------------- pages ---------------- */
const pages = []; // for sitemap: [path, lastmod, priority]
function page(p, html, lastmod, priority = 0.6) { write(p.endsWith("/") ? p + "index.html" : p, html); pages.push([p, lastmod || NOW, priority]); }

// Home
(function home() {
  const [lead, ...rest] = ARTICLES;
  const featured = ARTICLES.filter((a) => a.featured && a !== lead).concat(rest.filter((a) => !a.featured)).slice(0, 3);
  const latest = ARTICLES.filter((a) => a !== lead && !featured.includes(a)).slice(0, 6);
  const body = `
  <div class="wrap"><h1 class="sr-only">GIST MEDIA — what's happening in entertainment, celebrity, live music and sport</h1>
  ${lead ? `<section class="lead" aria-label="Top story">
    <article class="cover"><a href="${lead.url}" class="hoverzoom" style="display:block">${img(lead.image, { eager: true, alt: lead.image_alt, sizes: "(max-width: 900px) 100vw, 66vw" })}
      <div class="txt">${label(lead)}<h2>${esc(lead.title)}</h2><p class="standfirst">${esc(lead.description)}</p><div class="meta"><span>${esc(lead.author)}</span><span>${lead.read} min read</span><span>${esc(fmtDate(lead.date))}</span></div></div></a></article>
    <div class="supporting">${featured.map((a) => `<a class="sup card hoverzoom" href="${a.url}">${img(a.image, { ratio: "169", alt: a.image_alt, sizes: "(max-width: 900px) 50vw, 30vw" })}${label(a)}<h3>${esc(a.title)}</h3></a>`).join("")}</div>
  </section>` : ""}
  </div>
  ${latest.length ? `<section class="section tight" aria-labelledby="latest-h"><div class="wrap">
    <div class="sec-head"><h2 id="latest-h">What's happening</h2><a class="textlink" href="/news/">Everything ${ARROW}</a></div>
    ${newsGrid(latest)}</div></section>` : ""}
  <section class="section on-band" aria-labelledby="t-h"><div class="wrap">
    <div class="sec-head"><div><h2 id="t-h">Artist booking</h2><p class="intro" style="color:var(--band-muted)">${TALENT.artists.length} artists across film, Sufi, Punjabi, classical and indie, for weddings, private celebrations, corporate stages and brands.</p></div><a class="btn lime" href="/artist-booking/">See the roster ${ARROW}</a></div>
    <div class="agrid">${TALENT.artists.filter((a) => a.featured).concat(TALENT.artists.filter((a) => a.tier === "Icon")).slice(0, 6).map(artistCard).join("")}</div>
  </div></section>
  <section class="section" aria-labelledby="x-h"><div class="wrap">
    <div class="sec-head"><div><h2 id="x-h">Experiences</h2><p class="intro">${esc(ACCESS.intro)}</p></div><a class="btn" href="/experiences/">The season ${ARROW}</a></div>
    <div class="xcards">${ACCESS.experiences.slice(0, 4).map(expCard).join("")}</div>
  </div></section>
  <section class="nl" aria-labelledby="wa-h"><div class="wrap"><h2 id="wa-h">Booking an artist or an experience?</h2><div><p>Message the GIST desk on WhatsApp for availability and a quote.</p><p style="margin-top:16px"><a class="btn" href="${wa("Hi GIST, I'd like help with a booking.")}" target="_blank" rel="noopener" data-wa>WhatsApp ${esc(S.whatsappDisplay)}</a></p></div></div></section>`;
  page("/", layout({ path: "/", body, description: S.description, nav: "" , ld: [{ "@type": "WebPage", "@id": SITE + "/#home", url: SITE + "/", name: S.siteName, isPartOf: { "@id": SITE + "/#site" } }] }), ARTICLES[0]?.updated, 1.0);
})();

// News index + sections
function newsIndex(p, title, intro, list, sec) {
  const tabs = `<div class="tabs" role="list">${[["/news/", "All"], ...S.sections.map((s) => ["/news/" + s.id + "/", s.label])].map(([h, l]) => `<a class="chip" role="listitem" href="${h}"${h === p ? ' aria-current="page"' : ""}>${esc(l)}</a>`).join("")}</div>`;
  const body = `<div class="wrap"><header class="pagehead">${crumbs(sec ? [["/", "Home"], ["/news/", "What's Happening"], [p, title]] : [["/", "Home"], [p, "What's Happening"]])}<h1>${esc(title)}</h1><p class="standfirst">${esc(intro)}</p>${tabs}</header>
    <div class="section tight">${list.length ? newsGrid(list) : `<div class="empty"><h3>Nothing here yet</h3><p>No stories in this section yet. <a class="link" href="/news/">See everything</a>.</p></div>`}</div></div>`;
  page(p, layout({ title, description: intro, path: p, body, nav: "news", ld: [{ "@type": "CollectionPage", name: title, url: SITE + p }, crumbLd([["/", "Home"], ["/news/", "What's Happening"], ...(sec ? [[p, title]] : [])])] }), list[0]?.updated, 0.8);
}
newsIndex("/news/", "What's Happening", "Celebrity, music, movies, sport and the world's biggest events — the stories everyone's talking about, checked before we post them.", ARTICLES);
for (const s of S.sections) newsIndex(`/news/${s.id}/`, s.label, `The latest ${s.label.toLowerCase()} stories from GIST.`, ARTICLES.filter((a) => a.section === s.id), true);

// Articles
for (const a of ARTICLES) {
  const related = ARTICLES.filter((x) => x !== a && (x.section === a.section || x.tags.some((t) => a.tags.includes(t)))).slice(0, 3);
  while (related.length < 3 && related.length < ARTICLES.length - 1) { const n = ARTICLES.find((x) => x !== a && !related.includes(x)); if (!n) break; related.push(n); }
  const url = SITE + a.url;
  const disclosure = a.sponsored ? `<div class="disclosure"><strong>Paid partnership${a.sponsor ? " with " + esc(a.sponsor) : ""}.</strong> This is sponsored content.</div>` : a.disclosure ? `<div class="disclosure">${esc(a.disclosure)}</div>` : "";
  const sources = a.sources.length ? `<section class="sources" aria-labelledby="src-h"><h2 id="src-h">Sources</h2><ul>${a.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener nofollow" target="_blank">${esc(s.name || s.url)}</a></li>`).join("")}</ul></section>` : "";
  const origin = a.source_url ? `<p class="origin">First posted on <a href="${esc(a.source_url)}" rel="noopener" target="_blank">${esc(a.source === "linkedin" ? "LinkedIn" : a.source === "instagram" ? "Instagram" : "our socials")}</a>.</p>` : "";
  const ld = { "@type": "NewsArticle", "@id": url + "#article", mainEntityOfPage: url, headline: a.title.slice(0, 110), description: a.description, datePublished: iso(a.date), dateModified: iso(a.updated), image: a.image ? [SITE + (a.image.startsWith("/") ? a.image : "/img/" + a.image + ".webp")] : undefined, author: { "@type": "Organization", name: a.author, url: SITE + "/about/" }, publisher: { "@id": SITE + "/#org" }, articleSection: sectionLabel(a.section), keywords: a.tags.join(", "), isAccessibleForFree: true, inLanguage: "en-IN" };
  const body = `<article class="page-article"><div class="wrap">
    <header class="article-head">${crumbs([["/", "Home"], ["/news/", "What's Happening"], ["/news/" + a.section + "/", sectionLabel(a.section)], [a.url, a.title]])}
      ${label(a)}<h1>${esc(a.title)}</h1><p class="standfirst">${esc(a.description)}</p>
      <div class="byline"><div class="who"><span class="avatar" aria-hidden="true">G</span><div><strong>By ${esc(a.author)}</strong></div></div>
        <div class="dates"><div>Published <time datetime="${iso(a.date)}">${esc(fmtDate(a.date))}, ${esc(fmtTime(a.date))}</time></div>${+a.updated > +a.date ? `<div>Updated <time datetime="${iso(a.updated)}">${esc(fmtDate(a.updated))}, ${esc(fmtTime(a.updated))}</time></div>` : ""}</div>
        <div class="share" aria-label="Share this story"><button type="button" data-copy="${esc(url)}" aria-label="Copy link">${ICON.link}</button><a href="https://wa.me/?text=${encodeURIComponent(a.title + " " + url)}" target="_blank" rel="noopener" aria-label="Share on WhatsApp">${ICON.wa}</a><a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">${ICON.li}</a><a href="https://x.com/intent/post?text=${encodeURIComponent(a.title)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener" aria-label="Share on X">${ICON.x}</a></div>
      </div></header>
    ${a.image ? `<figure class="article-hero">${img(a.image, { eager: true, alt: a.image_alt, sizes: "(max-width: 1360px) 100vw, 1360px" })}<figcaption>${a.image_caption ? `<span>${esc(a.image_caption)}</span>` : "<span></span>"}<span class="credit">${esc(a.image_credit || "")}</span></figcaption></figure>` : ""}
    <div class="article-grid"><div></div>
      <div class="article-body">${disclosure}${a.html}${origin}${sources}</div>
      <aside class="article-aside" aria-label="About this story"><span class="kicker"><b>${a.read} min read</b></span><p>Filed under <a class="link" href="/news/${a.section}/">${esc(sectionLabel(a.section))}</a></p>${a.tags.length ? `<p class="tags">${a.tags.map((t) => `<span class="chip" style="cursor:default">${esc(t)}</span>`).join(" ")}</p>` : ""}<p class="muted" style="font-size:14px">Spotted an error? <a class="link" href="/editorial-policy/#corrections">Tell us</a>.</p></aside>
    </div></div>
    ${related.length ? `<section class="section" aria-labelledby="rel-h"><div class="wrap"><div class="sec-head"><h2 id="rel-h">More stories</h2><a class="textlink" href="/news/">Everything ${ARROW}</a></div><div class="newsgrid">${related.map((r) => storyCard(r, { cls: "g-4" })).join("")}</div></div></section>` : ""}
  </article>`;
  page(a.url, layout({ title: a.seo_title || a.title, description: a.description, path: a.url, body, nav: "news", ogType: "article", ogImage: a.image ? (a.image.startsWith("/") ? a.image : "/img/" + a.image + ".webp") : undefined, ld: [ld, crumbLd([["/", "Home"], ["/news/", "What's Happening"], [a.url, a.title]])],
    extraHead: `<meta property="article:published_time" content="${iso(a.date)}"><meta property="article:modified_time" content="${iso(a.updated)}"><meta property="article:section" content="${esc(sectionLabel(a.section))}">${a.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join("")}` }), a.updated, 0.7);
}

// Artist booking
(function talent() {
  const feat = TALENT.artists.filter((a) => a.featured);
  const lanes = TALENT.lanes.map((l) => `<section class="lane" aria-labelledby="l-${l.id}"><h2 id="l-${l.id}">${esc(l.label)} <span class="count">${TALENT.artists.filter((a) => a.lane === l.id).length} acts</span></h2><div class="agrid">${TALENT.artists.filter((a) => a.lane === l.id).map(artistCard).join("")}</div></section>`).join("");
  const body = `<div class="wrap"><header class="pagehead">${crumbs([["/", "Home"], ["/artist-booking/", "Artist Booking"]])}<h1>Artist booking</h1><p class="standfirst">Live artists for weddings, private celebrations, corporate stages and brands. One desk for availability, offer, contract, riders, travel and on-ground liaison.</p>
    <p class="headcta"><a class="btn" href="#enquire">Hold a date ${ARROW}</a><a class="btn ghost" href="${wa("Hi GIST, I'd like to book an artist.")}" target="_blank" rel="noopener" data-wa>WhatsApp the desk</a></p></header>
    <section class="section tight" aria-label="What we book for"><div class="occ">${TALENT.occasions.map(([t, d]) => `<div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}</div></section>
    <section class="section tight" aria-labelledby="f-h"><h2 id="f-h" class="h3s">Featured</h2><div class="feat-grid">${feat.map((a) => `<a class="fcard" href="/artist-booking/${a.slug}/"><span class="tier">${esc(a.role)}</span><h3>${esc(a.name)}</h3><p class="line">${esc(a.line)}</p><ul>${a.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul><span class="textlink">Profile ${ARROW}</span></a>`).join("")}</div></section>
    <section class="section tight" aria-labelledby="m-h"><h2 id="m-h" class="h3s">Match the moment</h2><div class="moments">${TALENT.moments.map((m) => `<div><h3>${esc(m.label)}</h3><p>${m.artists.map((n) => { const a = TALENT.artists.find((x) => x.name === n); return a ? `<a href="/artist-booking/${a.slug}/">${esc(n)}</a>` : esc(n); }).join(" · ")}</p></div>`).join("")}</div></section>
    <div class="section tight">${lanes}</div>
    <section class="section tight" aria-labelledby="s-h"><h2 id="s-h" class="h3s">From brief to final bow</h2>${steps(TALENT.steps)}</section>
    <section class="section">${talentForm()}</section></div>`;
  page("/artist-booking/", layout({ title: "Book an artist for your wedding, private or corporate event", description: `Book ${TALENT.artists.slice(2, 7).map((a) => a.name).join(", ")} and more for weddings, sangeet, private celebrations and corporate events. Availability and quotes from the GIST Talent desk.`, path: "/artist-booking/", body, nav: "artists", waText: "Hi GIST, I'd like to book an artist.", ld: [{ "@type": "Service", name: "GIST Talent — artist booking", serviceType: "Artist booking", provider: { "@id": SITE + "/#org" }, areaServed: "IN" }, crumbLd([["/", "Home"], ["/artist-booking/", "Artist Booking"]])] }), NOW, 0.9);

  for (const a of TALENT.artists) {
    const p = `/artist-booking/${a.slug}/`;
    const lane = a.laneLabel;
    const others = TALENT.artists.filter((x) => x !== a && x.lane === a.lane).slice(0, 4);
    const body = `<div class="wrap"><header class="pagehead artist-head">${crumbs([["/", "Home"], ["/artist-booking/", "Artist Booking"], [p, a.name]])}
      <span class="tier">${esc(a.featured ? a.role : lane + " · " + a.tier)}</span><h1>Book ${esc(a.name)}</h1><p class="standfirst">${esc(a.featured ? a.line : a.line)}</p>
      <p class="headcta"><a class="btn" href="#enquire">Check availability ${ARROW}</a><a class="btn ghost" href="${wa(`Hi GIST, I'd like to check availability for ${a.name}.`)}" target="_blank" rel="noopener" data-wa>WhatsApp</a></p></header>
      <section class="section tight two">
        <div>${a.highlights ? `<h2 class="h3s">Highlights</h2><ul class="bullets">${a.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : `<h2 class="h3s">Known for</h2><p class="prose" style="font-size:19px">${esc(a.line)}</p>`}
          ${a.formats ? `<h2 class="h3s" style="margin-top:28px">Formats</h2><p class="prose">${esc(a.formats)}</p>` : ""}</div>
        <div>${(a.bestFor || a.moments).length ? `<h2 class="h3s">Best for</h2><div class="tabs">${(a.bestFor || a.moments).map((x) => `<span class="chip" style="cursor:default">${esc(x)}</span>`).join("")}</div>` : ""}
          <h2 class="h3s" style="margin-top:28px">Booking with GIST</h2><p class="muted">Availability, offer, contract, riders, travel and on-ground liaison through one point of contact. Private dates and commercials stay private.</p></div>
      </section>
      <section class="section">${talentForm(a.slug)}</section>
      ${others.length ? `<section class="section tight" aria-labelledby="o-h"><div class="sec-head"><h2 id="o-h">Also in ${esc(lane)}</h2><a class="textlink" href="/artist-booking/">Full roster ${ARROW}</a></div><div class="agrid">${others.map(artistCard).join("")}</div></section>` : ""}
      <p class="fine">Artists listed are available to book through GIST subject to their availability and agreement. Listing does not imply exclusive representation.</p></div>`;
    page(p, layout({ title: `Book ${a.name} for weddings, private & corporate events`, description: `Check availability and get a quote to book ${a.name} (${a.featured ? a.role : lane}) for weddings, sangeet, private celebrations, corporate events and brand shows in India and abroad.`, path: p, body, nav: "artists", waText: `Hi GIST, I'd like to check availability for ${a.name}.`, ld: [{ "@type": "Service", name: `Book ${a.name}`, serviceType: "Artist booking", provider: { "@id": SITE + "/#org" }, areaServed: "IN" }, crumbLd([["/", "Home"], ["/artist-booking/", "Artist Booking"], [p, a.name]])] }), NOW, 0.7);
  }
})();

// Experiences
(function experiences() {
  const cal = ACCESS.calendar.map(([d, when, what, city, slug]) => `<li><a href="/experiences/${slug}/"><time datetime="${d}">${esc(when)}</time><span class="what">${esc(what)}</span><span class="city">${esc(city)}</span></a></li>`).join("");
  const body = `<div class="wrap"><header class="pagehead">${crumbs([["/", "Home"], ["/experiences/", "Experiences"]])}<h1>The season, 2026–27</h1><p class="standfirst">${esc(ACCESS.intro)}</p>
    <p class="headcta"><a class="btn" href="#enquire">Hold a place ${ARROW}</a><a class="btn ghost" href="${wa("Hi GIST, I'm interested in an experience.")}" target="_blank" rel="noopener" data-wa>WhatsApp the desk</a></p></header>
    <div class="xcards five">${ACCESS.experiences.map(expCard).join("")}</div>
    <section class="section tight" aria-labelledby="c-h"><h2 id="c-h" class="h3s">Ten months. Eleven dates.</h2><ol class="cal">${cal}</ol></section>
    <section class="section tight" aria-labelledby="w-h"><h2 id="w-h" class="h3s">What we arrange</h2><div class="occ">${ACCESS.arrange.map(([t, d]) => `<div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("")}</div></section>
    <section class="section tight" aria-labelledby="mo-h"><h2 id="mo-h" class="h3s">Match the occasion</h2><div class="moments">${ACCESS.occasions.map(([t, s, picks]) => `<div><h3>${esc(t)}</h3><p class="muted">${esc(s)}</p><p>${esc(picks)}</p></div>`).join("")}</div></section>
    <section class="section tight" aria-labelledby="st-h"><h2 id="st-h" class="h3s">From brief to the best seat</h2>${steps(ACCESS.steps)}</section>
    <section class="section">${accessForm()}</section>
    <p class="fine">${esc(ACCESS.terms)} GIST is an independent travel and hospitality arranger and is not affiliated with the events, artists or organisers named.</p></div>`;
  page("/experiences/", layout({ title: "F1, The Weeknd, Diljit suites, Tomorrowland & Wimbledon 2027 packages", description: "Private access to Formula 1, The Weeknd, Diljit Dosanjh private suites, Tomorrowland Thailand and Wimbledon 2027 — with stays, flights, transfers and concierge, arranged from India.", path: "/experiences/", body, nav: "experiences", waText: "Hi GIST, I'm interested in an experience.", ld: [crumbLd([["/", "Home"], ["/experiences/", "Experiences"]])] }), NOW, 0.9);

  for (const x of ACCESS.experiences) {
    const p = `/experiences/${x.slug}/`;
    const tables = (x.tables || (x.table ? [x.table] : [])).map(table).join("");
    const body = `<section class="x-hero" style="min-height:clamp(380px,48vw,600px)">${img(x.image, { eager: true, alt: "", sizes: "100vw" })}
      <div class="wrap">${crumbs([["/", "Home"], ["/experiences/", "Experiences"], [p, x.name]])}<span class="kicker"><b>${esc(x.category)}</b> · ${esc(x.subtitle)}</span><h1 style="margin-top:14px;font-size:clamp(44px,7.4vw,110px);max-width:16ch">${esc(x.name)}</h1></div></section>
      <div class="wrap">
      <dl class="x-summary"><div><dt>When</dt><dd>${esc(x.when)}</dd></div><div><dt>Where</dt><dd>${esc(x.where)}</dd></div><div><dt>Best for</dt><dd>${esc(x.bestFor.join(", "))}</dd></div><div><dt>Indicative</dt><dd>${esc(x.price)}</dd></div></dl>
      <div class="e-layout" style="padding-bottom:clamp(32px,5vw,64px)">
        <div style="display:grid;gap:clamp(28px,4vw,48px)">
          <section><p class="standfirst">${esc(x.line)}</p><ul class="bullets" style="margin-top:18px">${x.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul></section>
          <section><h2 class="h3s">${esc(x.detailTitle)}</h2>${x.detailIntro ? `<p class="muted" style="margin-bottom:14px">${esc(x.detailIntro)}</p>` : ""}${tables}${x.tableNote ? `<p class="fine">${esc(x.tableNote)}</p>` : ""}</section>
          ${x.options ? `<section><div class="opts">${x.options.map(([t, d]) => `<div><strong>${esc(t)}</strong><p>${esc(d)}</p></div>`).join("")}</div></section>` : ""}
          ${x.stays ? `<section><h2 class="h3s">Stays near the venue</h2><p>${esc(x.stays)}</p></section>` : ""}
          ${x.pick ? `<section class="pick"><h2 class="h3s">Our pick</h2><p class="standfirst">${esc(x.pick)}</p></section>` : ""}
          <section><h2 class="h3s">Access</h2><p>${esc(x.access)}</p></section>
        </div>
        <aside class="pricebox" aria-label="Pricing"><span class="kicker"><b>Indicative</b></span><div><div class="amt num">${esc(x.price)}</div><div class="unit">${esc(x.priceNote)}</div></div>
          <a class="btn" href="#enquire">Hold a place ${ARROW}</a><a class="btn ghost" href="${wa(`Hi GIST, I'm interested in ${x.name}.`)}" target="_blank" rel="noopener" data-wa>WhatsApp</a>
          <p class="muted" style="font-size:13px">Subject to availability. Pricing and inclusions are confirmed in writing before any payment.</p></aside>
      </div>
      <section class="section tight" style="padding-top:0">${accessForm(x.slug)}</section>
      <section class="section" aria-labelledby="more-x"><div class="sec-head"><h2 id="more-x">More from the season</h2><a class="textlink" href="/experiences/">All experiences ${ARROW}</a></div><div class="xcards">${ACCESS.experiences.filter((e) => e !== x).slice(0, 4).map(expCard).join("")}</div></section>
      <p class="fine">${esc(ACCESS.terms)} GIST is not affiliated with the organisers, artists or rights holders named. Photography is illustrative and does not depict the event.</p></div>`;
    page(p, layout({ title: `${x.name} ${x.subtitle.split(" · ")[0]} packages from India`, description: `${x.line} ${x.when}. ${x.price}. Access, stays, transfers and concierge arranged by GIST.`, path: p, body, nav: "experiences", waText: `Hi GIST, I'm interested in ${x.name}.`, ogImage: "/img/" + x.image + ".webp", ld: [crumbLd([["/", "Home"], ["/experiences/", "Experiences"], [p, x.name]])] }), NOW, 0.8);
  }
})();

// Static pages
const STATIC_PAGES = JSON.parse(fs.readFileSync(C("pages.json"), "utf8"));
for (const sp of STATIC_PAGES) {
  const html = marked.parse(sp.body.replace(/\{\{(\w+)\}\}/g, (_, k) => S[k] || ""));
  const body = `<div class="wrap"><header class="pagehead">${crumbs([["/", "Home"], [sp.path, sp.title]])}<h1>${esc(sp.title)}</h1>${sp.intro ? `<p class="standfirst">${esc(sp.intro)}</p>` : ""}</header>
    <div class="section tight ${sp.form ? "contactgrid" : ""}"><div class="prose legal">${html}</div>${sp.form ? `<form class="form formbox" data-form="Contact" novalidate><input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="grid2">${field("c-name", "Name", `<input id="c-name" name="name" required autocomplete="name">`)}${field("c-email", "Email", `<input id="c-email" name="email" type="email" required autocomplete="email">`)}</div>
      ${field("c-topic", "Topic", `<select id="c-topic" name="topic" required><option value="">Choose</option><option>Story tip</option><option>Correction</option><option>Artist booking</option><option>Experiences</option><option>Advertising & partnerships</option><option>Grievance</option><option>Other</option></select>`)}
      ${field("c-msg", "Message", `<textarea id="c-msg" name="message" required minlength="10" maxlength="3000"></textarea>`)}
      <div><button class="btn" type="submit">Send ${ARROW}</button></div><div class="status" role="status" aria-live="polite" hidden></div></form>` : ""}</div></div>`;
  page(sp.path, layout({ title: sp.title, description: sp.intro || sp.title, path: sp.path, body, ld: [crumbLd([["/", "Home"], [sp.path, sp.title]])] }), NOW, 0.3);
}

// 404
write("404.html", layout({ title: "Page not found", path: "/404", noindex: true, body: `<div class="wrap notfound"><h1>Lost the plot</h1><p class="standfirst">That page isn't here. It may have moved when we rebuilt the site.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="/">Home</a><a class="btn ghost" href="/news/">What's Happening</a></div></div>` }));

/* ---------------- feeds & SEO files ---------------- */
const xmlEsc = (s) => esc(s);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p, d, pr]) => `<url><loc>${SITE}${p}</loc><lastmod>${iso(d)}</lastmod><priority>${pr.toFixed(1)}</priority></url>`).join("\n")}\n</urlset>\n`);
const recent = ARTICLES.filter((a) => NOW - a.date < 2 * 864e5);   // Google News sitemap: last 48 hours only
write("news-sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${recent.map((a) => `<url><loc>${SITE}${a.url}</loc><news:news><news:publication><news:name>${xmlEsc(S.siteName)}</news:name><news:language>en</news:language></news:publication><news:publication_date>${iso(a.date)}</news:publication_date><news:title>${xmlEsc(a.title)}</news:title></news:news></url>`).join("\n")}\n</urlset>\n`);
write("news/rss.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEsc(S.siteName)}</title><link>${SITE}/news/</link><description>${xmlEsc(S.description)}</description><language>en-in</language><atom:link href="${SITE}/news/rss.xml" rel="self" type="application/rss+xml"/>\n${ARTICLES.slice(0, 50).map((a) => `<item><title>${xmlEsc(a.title)}</title><link>${SITE}${a.url}</link><guid isPermaLink="true">${SITE}${a.url}</guid><pubDate>${a.date.toUTCString()}</pubDate><category>${xmlEsc(sectionLabel(a.section))}</category><description>${xmlEsc(a.description)}</description></item>`).join("\n")}\n</channel></rss>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\nSitemap: ${SITE}/news-sitemap.xml\n`);
write("_headers", `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=2592000\n/admin/*\n  X-Robots-Tag: noindex\n`);
write("_redirects", `/index.html / 301\n/artists /artist-booking/ 301\n/artists/ /artist-booking/ 301\n/book-an-artist /artist-booking/ 301\n/tickets /experiences/ 301\n/shop / 301\n`);
// Machine-readable index for n8n (dedupe, "update existing story" lookups)
write("api/articles.json", JSON.stringify(ARTICLES.map((a) => ({ slug: a.slug, url: SITE + a.url, title: a.title, section: a.section, tags: a.tags, date: iso(a.date), updated: iso(a.updated), source_url: a.source_url || null })), null, 1));

/* ---------------- assets ---------------- */
copyDir(STATIC, OUT);
write("assets/site.css", fs.readFileSync(path.join(ROOT, "src/site.css"), "utf8") + "\n" + fs.readFileSync(path.join(ROOT, "src/extra.css"), "utf8"));
write("assets/site.js", fs.readFileSync(path.join(ROOT, "src/site.js"), "utf8"));
copyDir(path.join(ROOT, "admin"), path.join(OUT, "admin"));

console.log(`Built ${pages.length} pages, ${ARTICLES.length} articles → dist/`);
