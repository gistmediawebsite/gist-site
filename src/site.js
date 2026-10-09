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

  // Forms → GIST inbox (FormSubmit today; switch the endpoint in settings to an n8n webhook later)
  var endpoint = document.body.getAttribute("data-form-endpoint");
  var email = document.body.getAttribute("data-email");
  $$("form[data-form]").forEach(function (f) {
    var status = $(".status", f);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var data = {};
      new FormData(f).forEach(function (v, k) { data[k] = v; });
      if (data._honey) return;               // bot trap
      delete data._honey;
      var kind = f.getAttribute("data-form");
      var btn = $("button[type=submit]", f);
      btn.disabled = true; btn.setAttribute("aria-busy", "true");
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.assign({ _subject: "GIST website — " + kind, _template: "table", _captcha: "false", form: kind, page: location.href }, data))
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.success === false || j.success === "false") throw new Error(); }); })
        .then(function () {
          status.className = "status ok"; status.hidden = false;
          status.innerHTML = "<h4>Sent</h4><p>Thanks. The GIST desk will reply by email or WhatsApp, usually within a day.</p>";
          f.reset(); track("generate_lead", { form: kind, page_path: location.pathname });
        })
        .catch(function () {
          status.className = "status err"; status.hidden = false;
          status.innerHTML = "<h4>Not sent</h4><p>Something went wrong. Please try again, or email <a href=\"mailto:" + email + "\">" + email + "</a>.</p>";
        })
        .then(function () { btn.disabled = false; btn.removeAttribute("aria-busy"); status.focus && status.setAttribute("tabindex", "-1"); status.focus(); });
    });
  });
})();
