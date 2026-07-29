/* =========================================================================
   樹屋 Treehouse — shared site chrome + language mechanism

   ONE source of truth for header / nav / footer / language switch.
   Every page just drops <header id="site-header"> and <footer id="site-footer">
   mount points; this file renders them. Edit nav/footer here once → all pages
   update ("改一處即可維護").

   Phase B (visual layer) change note
   ----------------------------------
   - Brand lockup now = cabin logo image (/assets/treehouse-cabin.png) +
     the "treehouse" wordmark (Caprasimo). The wordmark is a logo, so it is
     the same string in every language (was the emoji 🏠 + localized t.brand).
   - Footer now leads with the same "treehouse" wordmark.
   - Nothing else changed: language detection / EN_READY gate / content
     toggling all behave exactly as before.

   Language model
   --------------
   - Each page carries its legal text inline as [data-lang="zh"] and (later)
     [data-lang="en"] blocks, so content is always in the DOM and readable
     even if JS fails (important for in-app webview + store reviewers).
   - EN_READY gate: until the English translation lands, we always show zh and
     the switch shows an "English coming soon" note. Flip EN_READY = true (and
     add [data-lang="en"] blocks) to enable auto browser-language detection.
   ========================================================================= */
(function () {
  "use strict";

  var EN_READY = true; // English content added to all pages; auto browser-language detection + zh/EN switch enabled

  var LOGO_SRC = "/assets/treehouse-cabin.png"; // self-hosted, no external CDN

  // ---- Pages (single source for nav + footer links) ----
  var PAGES = [
    { path: "/privacy",        key: "privacy" },
    { path: "/terms",          key: "terms" },
    { path: "/delete-account", key: "delete" },
    { path: "/faq",            key: "faq" },
    { path: "/child-safety",   key: "childSafety" }
  ];

  // ---- i18n strings for the CHROME only (page content lives in the HTML) ----
  var I18N = {
    zh: {
      htmlLang: "zh-Hant",
      brand: "樹屋",
      skip: "跳至主要內容",
      nav: { privacy: "隱私權政策", terms: "使用條款", delete: "刪除帳戶", faq: "常見問題", childSafety: "兒少安全" },
      footerLinksLabel: "頁面",
      company: "櫻桃科技有限公司（Cherryon CO., LTD.）",
      contactLabel: "聯絡我們",
      email: "support@cherryontech.com",
      rights: "版權所有。",
      enSoon: "English version is coming soon. The content below is currently shown in Traditional Chinese."
    },
    en: {
      htmlLang: "en",
      brand: "Treehouse",
      skip: "Skip to main content",
      nav: { privacy: "Privacy", terms: "Terms", delete: "Delete Account", faq: "FAQ", childSafety: "Child Safety" },
      footerLinksLabel: "Pages",
      company: "Cherryon CO., LTD.",
      contactLabel: "Contact",
      email: "support@cherryontech.com",
      rights: "All rights reserved.",
      enSoon: ""
    }
  };

  // ---- Resolve current language ----
  function detectLang() {
    var saved = null;
    try { saved = localStorage.getItem("th-lang"); } catch (e) {}
    if (saved === "zh" || (saved === "en" && EN_READY)) return saved;
    if (!EN_READY) return "zh";
    var nav = (navigator.language || "en").toLowerCase();
    return nav.indexOf("zh") === 0 ? "zh" : "en";
  }

  function currentKey() {
    var p = location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "");
    if (p === "") return "home";
    for (var i = 0; i < PAGES.length; i++) {
      if (PAGES[i].path === p) return PAGES[i].key;
    }
    return "home";
  }

  // ---- Render header ----
  function renderHeader(t, activeKey) {
    var navHtml = PAGES.map(function (pg) {
      var current = pg.key === activeKey ? ' aria-current="page"' : "";
      return '<a href="' + pg.path + '"' + current + '>' + t.nav[pg.key] + "</a>";
    }).join("");

    var langHtml = EN_READY
      ? '<div class="lang-switch" role="group" aria-label="Language">' +
          '<button type="button" data-set-lang="zh" aria-pressed="' + (t === I18N.zh) + '">中文</button>' +
          '<button type="button" data-set-lang="en" aria-pressed="' + (t === I18N.en) + '">EN</button>' +
        "</div>"
      : "";

    return '' +
      '<div class="site-header__inner">' +
        '<a class="brand" href="/faq" aria-label="Treehouse">' +
          '<span class="brand__logo" aria-hidden="true"><img src="' + LOGO_SRC + '" alt=""></span>' +
          '<span class="brand__name">treehouse</span>' +
        "</a>" +
        '<nav class="site-nav" aria-label="' + t.footerLinksLabel + '">' + navHtml + "</nav>" +
        langHtml +
      "</div>";
  }

  // ---- Render footer ----
  function renderFooter(t) {
    var links = PAGES.map(function (pg) {
      return '<a href="' + pg.path + '">' + t.nav[pg.key] + "</a>";
    }).join("");
    var year = "2026"; // static build; bump if needed
    return '' +
      '<div class="site-footer__inner">' +
        '<p class="foot-word">treehouse</p>' +
        '<nav class="site-footer__links" aria-label="' + t.footerLinksLabel + '">' + links + "</nav>" +
        "<p>" + t.company + "</p>" +
        "<p>" + t.contactLabel + "：<a href=\"mailto:" + t.email + "\">" + t.email + "</a></p>" +
        "<p>&copy; " + year + " " + t.company + " " + t.rights + "</p>" +
      "</div>";
  }

  // ---- Toggle inline content blocks by language ----
  function applyContentLang(lang) {
    var blocks = document.querySelectorAll("[data-lang]");
    var hasEn = false;
    blocks.forEach(function (b) { if (b.getAttribute("data-lang") === "en") hasEn = true; });
    var effective = (lang === "en" && (!EN_READY || !hasEn)) ? "zh" : lang;
    blocks.forEach(function (b) {
      b.hidden = b.getAttribute("data-lang") !== effective;
    });
    // English-coming-soon notice
    var notice = document.getElementById("lang-notice");
    if (notice) {
      var showNotice = (lang === "en") && !EN_READY;
      notice.hidden = !showNotice;
      if (showNotice) notice.textContent = I18N.zh.enSoon;
    }
  }

  function setLang(lang) {
    var t = I18N[lang] || I18N.zh;
    document.documentElement.setAttribute("lang", t.htmlLang);
    try { localStorage.setItem("th-lang", lang); } catch (e) {}

    var header = document.getElementById("site-header");
    var footer = document.getElementById("site-footer");
    if (header) { header.className = "site-header"; header.innerHTML = renderHeader(t, currentKey()); }
    if (footer) { footer.className = "site-footer"; footer.innerHTML = renderFooter(t); }

    // skip link text
    var skip = document.querySelector(".skip-link");
    if (skip) skip.textContent = t.skip;

    applyContentLang(lang);
    wireLangButtons();
  }

  function wireLangButtons() {
    var btns = document.querySelectorAll("[data-set-lang]");
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLang(btn.getAttribute("data-set-lang"));
      });
    });
  }

  function init() { setLang(detectLang()); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
