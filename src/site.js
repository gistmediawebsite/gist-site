(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var track = function (name, params) { try { if (window.gtag) window.gtag("event", name, params || {}); } catch (e) {} };

  // Old single-page links (gistmedia.org/#artists etc.) → new pages
  var h = location.hash.replace(/^#/, "");
  if (h && location.pathname === "/") {
    var map = { news: "/news/", artists: "/artist-booking/", experiences: "/experiences/", tickets: "/experiences/", concierge: "/experiences/", about: "/about/", contact: "/contact/", privacy: "/privacy/", terms: "/terms/", advertise: "/contact/", partner: "/contact/", submit: "/contact/" };
    var to = map[h] || (/^article-/.test(h) ? "/news/" : /^artist-/.test(h) ? "/artist-booking/" : /^(experience|event)-/.test(h) ? "/experiences/" : /^news-/.test(h) ? "/news/" : null);
    if (to) location.replace(to);
  }

  // Compact logo in the sticky bar once the masthead scrolls away
  var nav = $(".navbar"), mast = $(".masthead");
  if (nav && mast && "IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { nav.classList.toggle("stuck", !e[0].isIntersecting); }).observe(mast);
  }

  // Copy link
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var u = b.getAttribute("data-copy");
      (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { b.setAttribute("aria-label", "Link copied"); b.classList.add("done"); }, function () { prompt("Copy this link:", u); });
    });
  });

  // WhatsApp clicks (GA4 event)
  $$("[data-wa]").forEach(function (a) { a.addEventListener("click", function () { track("whatsapp_click", { page_path: location.pathname }); }); });

  // Forms → n8n "GIST HQ — Website enquiries" (emails gaurav@gistmedia.org tagged [GIST-WEB], saves to GIST Leads)
  var endpoint = document.body.getAttribute("data-form-endpoint");
  var email = document.body.getAttribute("data-email");
  var siteKey = document.body.getAttribute("data-turnstile");
  var forms = $$("form[data-form]");

  // "Other" in any dropdown opens a "Please specify" box
  forms.forEach(function (f) {
    $$("select[data-other]", f).forEach(function (sel) {
      var box = $("#" + sel.getAttribute("data-other"), f);
      if (!box) return;
      var inp = $("input,textarea", box);
      var sync = function () {
        var on = sel.value === "Other";
        box.hidden = !on; inp.required = on; inp.disabled = !on;
        if (on && document.activeElement === sel) setTimeout(function () { inp.focus(); }, 0);
      };
      sel.addEventListener("change", sync); sync();
    });
  });

  // Spam protection (Cloudflare Turnstile), loaded only on pages with a form
  if (forms.length && siteKey) {
    forms.forEach(function (f) {
      var slot = $(".ts-slot", f);
      if (slot) { slot.className = "ts-slot cf-turnstile"; slot.setAttribute("data-sitekey", siteKey); slot.setAttribute("data-size", "flexible"); slot.setAttribute("data-theme", "auto"); slot.setAttribute("data-appearance", "interaction-only"); }
    });
    var ts = document.createElement("script");
    ts.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"; ts.async = true; ts.defer = true;
    document.head.appendChild(ts);
  }

  var fieldMsg = function (el, text) {
    var wrap = el.closest(".field"); if (!wrap) return;
    var m = $(".msg", wrap);
    if (!m) { m = document.createElement("span"); m.className = "msg"; m.id = el.id + "-msg"; wrap.appendChild(m); el.setAttribute("aria-describedby", m.id); }
    m.textContent = text || ""; wrap.classList.toggle("err", !!text);
  };
  var explain = function (el) {
    var v = el.validity;
    if (v.valueMissing) return el.tagName === "SELECT" ? "Please choose one." : "Please fill this in.";
    if (v.typeMismatch && el.type === "email") return "Please enter a valid email address.";
    if (v.tooShort) return "Please write at least " + el.minLength + " characters.";
    if (v.rangeUnderflow || v.rangeOverflow) return "Please enter a number between " + el.min + " and " + el.max + ".";
    if (v.patternMismatch) return el.getAttribute("data-pattern-msg") || "Please check this.";
    return "Please check this.";
  };

  forms.forEach(function (f) {
    var status = $(".status", f);
    var btn = $("button[type=submit]", f);
    $$("input,select,textarea", f).forEach(function (el) {
      el.addEventListener("input", function () { if (el.closest(".field.err") && el.checkValidity()) fieldMsg(el, ""); });
      el.addEventListener("change", function () { if (el.closest(".field.err") && el.checkValidity()) fieldMsg(el, ""); });
    });
    var show = function (cls, html) { status.className = "status " + cls; status.hidden = false; status.innerHTML = html; status.setAttribute("tabindex", "-1"); status.focus(); };
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var bad = $$("input,select,textarea", f).filter(function (el) { return !el.disabled && el.name && el.name !== "_honey" && !el.checkValidity(); });
      $$("input,select,textarea", f).forEach(function (el) { if (el.checkValidity()) fieldMsg(el, ""); });
      if (bad.length) { bad.forEach(function (el) { fieldMsg(el, explain(el)); }); bad[0].focus(); return; }
      var data = {};
      new FormData(f).forEach(function (v, k) { if (typeof v === "string") data[k] = v; });
      if (data._honey) return;               // bot trap
      delete data._honey;
      if (siteKey && !data["cf-turnstile-response"]) { show("err", "<h4>One moment</h4><p>We're running a quick security check. Please press send again in a few seconds.</p>"); return; }
      var kind = f.getAttribute("data-form");
      btn.disabled = true; btn.setAttribute("aria-busy", "true");
      var label = btn.innerHTML; btn.innerHTML = "Sending…";
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, 30000) : null;
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.assign({ form: kind, page: location.href }, data)),
        signal: ctl ? ctl.signal : undefined
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.success !== true) { var e = new Error("send"); e.detail = j; throw e; } return j; }); })
        .then(function (j) {
          show("ok", "<h4>Sent</h4><p>Thanks. The GIST desk will reply by email or WhatsApp, usually within a day." + (j.ref ? " Your reference: " + j.ref + "." : "") + "</p>");
          f.reset(); $$("select[data-other]", f).forEach(function (s) { s.dispatchEvent(new Event("change")); });
          track("generate_lead", { form: kind, page_path: location.pathname });
        })
        .catch(function (e) {
          var errs = (e && e.detail && e.detail.errors) || [];
          var why = errs.indexOf("spam check failed") > -1 ? "The security check didn't go through. Please press send again." : errs.indexOf("email invalid") > -1 ? "Please check your email address." : "Something went wrong on our side.";
          show("err", "<h4>Not sent</h4><p>" + why + " You can also email <a href=\"mailto:" + email + "\">" + email + "</a> or WhatsApp us.</p>");
        })
        .then(function () {
          if (timer) clearTimeout(timer);
          btn.disabled = false; btn.removeAttribute("aria-busy"); btn.innerHTML = label;
          try { if (window.turnstile) window.turnstile.reset($(".cf-turnstile", f)); } catch (x) {}
        });
    });
  });

  // Spotlight grid: fade cards in row by row; on touch screens, light up the card in the middle of the screen
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var grids = $$(".agrid");
    grids.forEach(function (g) { g.classList.add("reveal"); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -10% 0px" });
    grids.forEach(function (g) { io.observe(g); });
  }
  if ("IntersectionObserver" in window && matchMedia("(hover: none)").matches) {
    var lit = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle("lit", e.isIntersecting); }); }, { rootMargin: "-40% 0px -40% 0px" });
    $$(".acard.hasphoto").forEach(function (c) { lit.observe(c); });
  }
})();
