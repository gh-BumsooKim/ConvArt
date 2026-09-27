/* ConvArt project page — interactions */
(function () {
  "use strict";

  const D = window.CONVART_DATA || { gallery: [], explore: [] };
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

  /* ───────── theme ───────── */
  const root = document.documentElement;
  const saved = (() => { try { return localStorage.getItem("convart-theme"); } catch (e) { return null; } })();
  if (saved) root.setAttribute("data-theme", saved);
  $("#themeBtn").addEventListener("click", () => {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    const cur = root.getAttribute("data-theme") || (dark ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("convart-theme", next); } catch (e) {}
  });

  /* ───────── math ─────────
     KaTeX is loaded with `defer`, so it is only guaranteed to exist once the document
     has been parsed. Each .eq keeps a readable plain-text version as its child; we
     replace it only after a successful render, so a blocked CDN degrades gracefully. */
  function renderMath() {
    if (!window.katex) return;
    document.querySelectorAll(".eq[data-tex]").forEach(n => {
      try {
        katex.render(n.dataset.tex, n, { displayMode: true, throwOnError: false });
        n.classList.add("eq-tex");
      } catch (e) { /* keep the fallback text */ }
    });
  }
  (function waitForKatex(tries) {
    if (window.katex) return renderMath();
    if (tries > 0) setTimeout(function () { waitForKatex(tries - 1); }, 60);
  })(50);   // give the CDN ~3 s, then keep the plain-text fallback

  /* ───────── gallery ─────────
     PER_DOMAIN caps how many results each domain contributes, taken in manifest
     order. The manifest itself is untouched, so raising the cap (or setting it to
     Infinity) brings the rest back without regenerating anything. */
  const DOMAINS = ["Vector Art", "Product", "Creature", "Logo", "Typography"];
  const PER_DOMAIN = 6;
  const grid = $("#grid"), filters = $("#filters");
  const shown = (() => {
    const n = {};
    return D.gallery.filter(it => (n[it.domain] = (n[it.domain] || 0) + 1) <= PER_DOMAIN);
  })();

  function card(it) {
    const c = el("article", "card");
    c.dataset.domain = it.domain;
    c.innerHTML =
      '<div class="card-row">' +
        '<div class="card-ins">' +
          '<img loading="lazy" src="assets/gallery/' + it.id + '_a.webp" alt="Input 1 — ' + it.title + '" width="320" height="320">' +
          '<img loading="lazy" src="assets/gallery/' + it.id + '_b.webp" alt="Input 2 — ' + it.title + '" width="320" height="320">' +
        '</div>' +
        '<img class="card-out" loading="lazy" src="assets/gallery/' + it.id + '_out.webp" alt="ConvArt result — ' + it.title + '" width="320" height="320">' +
      '</div>' +
      '<div class="card-meta"><span class="card-title">' + it.title + '</span>' +
      '<span class="card-dom">' + it.domain + '</span></div>';
    return c;
  }

  if (grid) {
    shown.forEach(it => grid.appendChild(card(it)));

    const counts = {};
    shown.forEach(it => { counts[it.domain] = (counts[it.domain] || 0) + 1; });
    const cats = ["All"].concat(DOMAINS.filter(d => counts[d]));

    cats.forEach((name, i) => {
      const n = name === "All" ? shown.length : counts[name];
      const b = el("button", "filter", name + '<span class="n">' + n + "</span>");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.addEventListener("click", () => {
        filters.querySelectorAll(".filter").forEach(x => x.setAttribute("aria-selected", "false"));
        b.setAttribute("aria-selected", "true");
        grid.querySelectorAll(".card").forEach(c => {
          c.style.display = (name === "All" || c.dataset.domain === name) ? "" : "none";
        });
      });
      filters.appendChild(b);
    });
  }

  

  /* ───────── title gimmick — creative synthesis on the title ─────────
     Every letter carries the two sources it was made from — x₁ solid and warm, x₂
     outlined and cool — and --w is how far apart they are pulled. A smoothstep falloff
     around a focus that lags the pointer gives a soft band rather than a hard cut, so
     moving across the title takes it back apart into the two things it was made of.

     On top of that there is a self-playing assembly pass: the letters scatter out to
     the two side margins and fly back in to assemble the title. It runs shortly after
     load and then replays on a cycle, but only while the pointer is idle — any
     pointer movement cancels it and hands the title back to the inspection effect. */
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const heroEl = $(".hero"), titleEl = $("#heroTitle");
  if (heroEl && titleEl && !REDUCED) {
    const R = 125;                       // px: how far the pointer pulls letters apart
    const chars = [];
    const plain = [];                    // the untouched text, kept for selection/copy

    // split into words (kept unbreakable) and then letters, each carrying both conventions
    titleEl.querySelectorAll(".tl").forEach(line => {
      const frag = document.createDocumentFragment();
      plain.push(line.textContent.trim());
      line.textContent.trim().split(/(\s+)/).forEach(tok => {
        if (!tok.trim()) { frag.appendChild(document.createTextNode(" ")); return; }
        const word = el("span", "w");
        for (const c of tok) {
          const ch = el("span", "ch");
          ch.appendChild(el("span", "cf", c));      // x₁ — solid
          ch.appendChild(el("span", "ct", c));      // the blend's warm cast
          ch.appendChild(el("span", "co", c));      // x₂ — outline
          word.appendChild(ch);
          chars.push({ node: ch, w: 0, to: 0, wPrev: -1, kPrev: -1, pop: 0, x: 0, y: 0 });
        }
        frag.appendChild(word);
      });
      line.textContent = "";
      line.appendChild(frag);
    });

    if (chars.length) {
      /* Each letter is its own inline-block, which selection serialises as a separate
         word ("C o n v e n t i o n"). So the letters are unselectable and an off-screen
         copy of the real text carries the selection instead. */
      titleEl.querySelectorAll(".tl").forEach(l => l.setAttribute("aria-hidden", "true"));
      const sr = el("span", "t-sr", plain.join(" "));
      sr.setAttribute("aria-hidden", "true");        // the h1's aria-label already says it
      titleEl.appendChild(sr);

      let fx = -1e4, fy = -1e4, tx = -1e4, ty = -1e4, raf = null, measured = false;

      /* idle wave — a band that travels across the title from the front, splitting each
         letter into its two sources as it passes and letting it close again behind.
         BAND is the width of the band as a fraction of the sweep; TILT is how much the
         lower line lags the upper one, so the band reads as a wave rather than a bar. */
      let pass = 0, passAt = performance.now() + 400, lastMove = -1e9;
      const BAND = 0.17, TILT = 0.12, PEAK = 0.85;
      const PASS_MS = 2600, GAP_MS = 3600, IDLE_MS = 2500;

      /* Offsets are stored relative to the title box and the box itself is re-read once
         per frame, so scrolling costs one rect instead of 61 and only a resize or a late
         webfont can invalidate the cache. */
      const measure = () => {
        const t = titleEl.getBoundingClientRect();
        chars.forEach(c => {
          const r = c.node.getBoundingClientRect();
          c.x = r.left + r.width / 2 - t.left;
          c.y = r.top + r.height / 2 - t.top;
        });
        measured = true;
      };
      addEventListener("resize", () => { measured = false; });
      // Source Serif arrives after first paint and reflows every glyph
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measured = false; });
      setTimeout(() => { measured = false; }, 1500);

      /* Only a pointer NEAR the title counts as interaction. The listener has to sit on
         the whole hero (the letters are small targets and the falloff reaches past
         them), but moving anywhere else in the hero must not interrupt the wave — so
         the cancel is gated on the pointer's distance to the title box itself, using
         the same radius the falloff uses. */
      let lastBox = null;
      heroEl.addEventListener("pointermove", e => {
        tx = e.clientX; ty = e.clientY;                   // the focus only *chases* this
        if (fx < -1e3) { fx = tx; fy = ty; }              // no swoop in from off-screen
        const b = lastBox;
        if (!b) return;
        const dx = Math.max(b.left - tx, 0, tx - b.right);   // point-to-rect distance
        const dy = Math.max(b.top - ty, 0, ty - b.bottom);
        if (dx * dx + dy * dy < R * R) { lastMove = performance.now(); pass = 0; }
      });
      heroEl.addEventListener("pointerleave", () => { tx = -1e4; ty = -1e4; });

      const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

      function frame(t) {
        if (!measured) measure();
        const box = titleEl.getBoundingClientRect();
        lastBox = box;                     // the pointermove handler tests against this

        /* Start a pass once the pointer has been still for IDLE_MS and the cycle is
           due; q runs 0 → 1 across it. The first one is scheduled 400 ms after load,
           which is the "plays when you open the page" case. The band starts one
           BAND-width off the front edge and leaves one off the back, so it enters and
           exits cleanly instead of popping on at the first letter. */
        if (!pass && t - lastMove > IDLE_MS && t > passAt) pass = t;
        let q = -1;
        if (pass) {
          q = (t - pass) / PASS_MS;
          if (q >= 1) { pass = 0; q = -1; passAt = t + GAP_MS; }
        }
        const head = q >= 0 ? -BAND + q * (1 + TILT + 2 * BAND) : 0;

        // (4) the focus lags the pointer, so the effect feels like a tool laying
        //     something down rather than a value tracking the cursor exactly
        fx += (tx - fx) * 0.18;
        fy += (ty - fy) * 0.18;
        const lx = fx - box.left, ly = fy - box.top;

        for (const c of chars) {
          if (q >= 0) {
            // where this letter sits along the sweep: mostly its x, tilted by its line
            const p = c.x / box.width + (c.y / box.height) * TILT;
            const u = clamp01(1 - Math.abs(head - p) / BAND);
            c.to = u * u * (3 - 2 * u) * PEAK;
          } else {
            const dx = c.x - lx, dy = (c.y - ly) * 1.35;  // squash: favour a horizontal band
            const u = clamp01(1 - Math.sqrt(dx * dx + dy * dy) / R);
            c.to = u * u * (3 - 2 * u) * PEAK;            // never fully dissolve the letter
          }

          if (Math.abs(c.to - c.w) > 0.002) c.w += (c.to - c.w) * 0.26;
          else c.w = c.to;

          if (c.w !== c.wPrev) {
            c.node.style.setProperty("--w", c.w.toFixed(3));
            c.wPrev = c.w;
          }
        }
        raf = requestAnimationFrame(frame);
      }

      raf = requestAnimationFrame(frame);
      if ("IntersectionObserver" in window) {            // idle while the hero is off screen
        new IntersectionObserver(es => {
          es.forEach(e => {
            if (e.isIntersecting) { if (!raf) raf = requestAnimationFrame(frame); }
            else if (raf) { cancelAnimationFrame(raf); raf = null; }
          });
        }, { threshold: 0 }).observe(titleEl);
      }

    }
  }

  

  /* ───────── preference chart ───────── */
  const CHART = [
    { name: "DreamO",  f: 0.0,  i: 2.9,  t: 5.7 },
    { name: "FLUX-2",  f: 26.5, i: 29.4, t: 25.7 },
    { name: "NB2",     f: 23.5, i: 26.5, t: 25.7 },
    { name: "Ours",    f: 50.0, i: 41.2, t: 42.9, ours: true }
  ];
  const chart = $("#chart");
  if (chart) {
    const MAX = 56;
    CHART.forEach(m => {
      const g = el("div", "grp" + (m.ours ? " ours" : ""));
      const bars = el("div", "grp-bars");
      [["f", m.f], ["i", m.i], ["t", m.t]].forEach(([k, v]) => {
        const b = el("div", "bar " + k, "<span>" + v.toFixed(1) + "%</span>");
        b.style.setProperty("--h", "0%");
        b.dataset.h = (v / MAX) * 100 + "%";
        bars.appendChild(b);
      });
      g.appendChild(bars);
      g.appendChild(el("div", "grp-name", m.name));
      chart.appendChild(g);
    });
    const grow = () => chart.querySelectorAll(".bar").forEach(b => b.style.setProperty("--h", b.dataset.h));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => {
        es.forEach(e => { if (e.isIntersecting) { grow(); io.disconnect(); } });
      }, { threshold: 0.25 });
      io.observe(chart);
    } else grow();
  }

  /* ───────── more research strip ─────────
     The CSS drifts the track by exactly half its width, which only loops seamlessly if
     the second half is a copy of the first. Clone rather than duplicate the markup, and
     hide the copy from assistive tech so the links are not announced twice. */
  const track = $("#moreTrack");
  if (track && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    Array.from(track.children).forEach(card => {
      const twin = card.cloneNode(true);
      twin.setAttribute("aria-hidden", "true");
      twin.setAttribute("tabindex", "-1");
      track.appendChild(twin);
    });
  }

  /* ───────── copying ─────────
     The async clipboard API needs a secure context (https / localhost); the textarea
     fallback covers the page opened straight from disk. */
  const copyText = async text => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = el("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    return ok;
  };
  const toastEl = $("#toast");
  let toastT;
  const toast = msg => {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 1600);
  };
  const flash = (btn, ok) => {
    btn.classList.toggle("done", ok);
    setTimeout(() => btn.classList.remove("done"), 1600);
  };

  const cb = $("#copyBtn");
  if (cb) cb.addEventListener("click", async () => {
    const ok = await copyText($("#bibText").innerText.trim());
    cb.textContent = ok ? "Copied" : "Press ⌘/Ctrl+C";
    flash(cb, ok);
    setTimeout(() => { cb.textContent = "Copy"; }, 1600);
  });

  // the title is split into per-letter spans for the pointer effect, so selecting it
  // by hand is awkward — this copies the plain title (the h1's aria-label)
  const ct = $("#copyTitle");
  if (ct) ct.addEventListener("click", async () => {
    const ok = await copyText($("#heroTitle").getAttribute("aria-label"));
    flash(ct, ok);
    toast(ok ? "Title copied" : "Could not copy — select the title in the footer instead");
  });

  // section numbers are permalinks: jump there, and put the link on the clipboard
  document.querySelectorAll(".sec-num[href^='#']").forEach(a => a.addEventListener("click", async e => {
    e.preventDefault();
    const url = location.href.split("#")[0] + a.getAttribute("href");
    history.replaceState(null, "", a.getAttribute("href"));
    a.closest("section").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
    toast(await copyText(url) ? "Link to this section copied" : "Link is in the address bar");
  }));

  /* ───────── visitor map palette ─────────
     The map is a flat PNG the vendor renders on demand, keyed by (width, sea, land)
     in its own filename — so rather than live with its default blue, mirror the page's
     --sea / --land into that URL and the tile follows the theme. The colours stay
     owned by style.css; this only rewrites the image, and re-runs when the theme
     changes. The widget is injected asynchronously (it fetches its own jQuery first),
     so poll briefly for it, the same way the KaTeX block above does. Everything here
     no-ops if the script is blocked or never arrives. */
  (function paintMap(tries) {
    const map = document.querySelector(".mapmyvisitors-map");
    if (!map) { if (tries > 0) setTimeout(() => paintMap(tries - 1), 80); return; }

    const token = n => getComputedStyle(root).getPropertyValue(n).trim().replace("#", "");
    const apply = () => {
      // the width is fixed by the vendor at injection time; keep whatever it chose
      const w = (map.style.backgroundImage.match(/bg-w_([\d.]+)/) || [])[1];
      if (!w) return;
      const want = "https://mapmyvisitors.com/generated_content/backs/bg-w_" + w +
                   "-co_" + token("--sea") + "-cl_" + token("--land") + ".png";
      if (map.style.backgroundImage.indexOf(want) !== -1) return;   // guards the observer
      map.style.backgroundImage = 'url("' + want + '")';
    };
    apply();

    // the vendor rewrites the style attribute once its data call returns, so watch it
    new MutationObserver(apply).observe(map, { attributes: true, attributeFilter: ["style"] });
    new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", apply);
  })(50);

  /* ───────── running head ─────────
     The current section is the last one whose top has passed just under the head;
     above the first section (the hero) there is none, and the head shows only the
     index. Wide screens show it as text beside the numbers, narrow ones as the label
     of the dropdown button. */
  const rhNav = $("#rhNav"), rhBtn = $("#rhBtn");
  const idx = Array.from(document.querySelectorAll("#rhList a"))
    .map(a => ({ a, sec: document.querySelector(a.getAttribute("href")),
                 num: a.querySelector("b").textContent, lbl: a.querySelector("span").textContent }))
    .filter(x => x.sec);
  if (rhNav && idx.length) {
    const rhNow = $("#rhNow"), rhNum = $("#rhNum"), rhLbl = $("#rhLbl");
    const setOpen = open => {
      rhNav.classList.toggle("open", open);
      rhBtn.setAttribute("aria-expanded", String(open));
    };
    rhBtn.addEventListener("click", e => { e.stopPropagation(); setOpen(!rhNav.classList.contains("open")); });
    idx.forEach(x => x.a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("click", e => { if (!rhNav.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") setOpen(false); });

    let shown;
    const pick = () => {
      const line = $("#rh").offsetHeight + 40;
      let cur = null;
      for (const x of idx) { if (x.sec.getBoundingClientRect().top <= line) cur = x; else break; }
      if (cur === shown) return;
      shown = cur;
      idx.forEach(x => x.a.classList.toggle("on", x === cur));
      rhNow.innerHTML = cur ? "<b>" + cur.num + "</b>" + cur.lbl : "";
      rhNum.textContent = cur ? cur.num : "§";
      rhLbl.textContent = cur ? cur.lbl : "Contents";
    };
    // ten rect reads per scroll event is cheap enough not to need batching
    addEventListener("scroll", pick, { passive: true });
    addEventListener("resize", pick);
    pick();
  }

  /* ───────── back to top ─────────
     Shown once the hero has scrolled away; the ring shows how far down the page is. */
  const toTop = $("#toTop");
  if (toTop) {
    const heroH = () => ($(".hero") || document.body).offsetHeight * 0.6;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      toTop.classList.toggle("show", scrollY > heroH());
      toTop.style.setProperty("--p", max > 0 ? Math.min(100, (scrollY / max) * 100).toFixed(1) : 0);
    };
    toTop.addEventListener("click", e => {
      e.preventDefault();
      scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
      history.replaceState(null, "", location.pathname + location.search);
    });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
  }

  /* ───────── figure viewer ─────────
     Click a paper figure to open it full-window. Zoom is about the pointer: a screen
     point P sits over image point u = (P − C − t) / s, where C is the stage centre and
     t the pan; keeping u under P while s changes gives t' = P − C − (s'/s)(P − C − t).
     Drag pans once zoomed; a click that did not drag closes it. */
  const lb = $("#lb");
  if (lb) {
    const stage = $("#lbStage"), img = $("#lbImg"), cap = $("#lbCap"), pct = $("#lbPct");
    const MIN = 1, MAX = 5, STEP = 1.4;
    let s = 1, tx = 0, ty = 0, opener = null, drag = null;

    const clampPan = () => {
      // keep at least the fitted image's footprint covered — no panning off into black
      const w = img.offsetWidth, h = img.offsetHeight;
      const mx = Math.max(0, (w * s - w) / 2), my = Math.max(0, (h * s - h) / 2);
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
    };
    const apply = () => {
      clampPan();
      img.style.setProperty("--s", s);
      img.style.setProperty("--tx", tx + "px");
      img.style.setProperty("--ty", ty + "px");
      pct.textContent = Math.round(s * 100) + "%";
      stage.classList.toggle("can-pan", s > 1);
    };
    const zoomAt = (ns, px, py) => {
      ns = Math.min(MAX, Math.max(MIN, ns));
      const r = stage.getBoundingClientRect();
      // the image is centred in the stage's content box
      const cx = r.left + r.width / 2, cy = r.top + (r.height + parseFloat(getComputedStyle(stage).paddingTop)) / 2;
      if (px == null) { px = cx; py = cy; }
      tx = px - cx - (ns / s) * (px - cx - tx);
      ty = py - cy - (ns / s) * (py - cy - ty);
      s = ns;
      if (s === 1) tx = ty = 0;
      apply();
    };

    const open = src => {
      opener = document.activeElement;
      const fig = src.closest("figure");
      const fc = fig && fig.querySelector("figcaption");
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      // caption text without the third-party credit line
      cap.textContent = fc ? Array.from(fc.childNodes)
        .filter(n => !(n.classList && n.classList.contains("credit")))
        .map(n => n.textContent).join("").replace(/\s+/g, " ").trim() : "";
      s = 1; tx = ty = 0; apply();
      lb.hidden = false;
      document.documentElement.classList.add("lb-open");
      $("#lbClose").focus();
    };
    const close = () => {
      lb.hidden = true;
      document.documentElement.classList.remove("lb-open");
      if (opener && opener.focus) opener.focus();
    };

    document.querySelectorAll(".fig img, .teaser img").forEach(im => {
      im.tabIndex = 0;
      im.setAttribute("role", "button");
      im.setAttribute("aria-label", "Enlarge figure: " + im.alt);
      im.addEventListener("click", () => open(im));
      im.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(im); } });
    });

    lb.querySelectorAll("[data-z]").forEach(b => b.addEventListener("click", () => {
      const z = b.dataset.z;
      zoomAt(z === "in" ? s * STEP : z === "out" ? s / STEP : 1);
    }));
    $("#lbClose").addEventListener("click", close);

    stage.addEventListener("wheel", e => {
      e.preventDefault();
      zoomAt(s * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
    }, { passive: false });
    stage.addEventListener("dblclick", e => zoomAt(s > 1 ? 1 : 2, e.clientX, e.clientY));

    stage.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      // remember where the press began: once the stage captures the pointer, every
      // later event targets the stage itself
      drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false, onImg: e.target === img };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      if (s > 1) {
        stage.classList.add("panning");
        tx = drag.tx + dx; ty = drag.ty + dy; apply();
      }
    });
    stage.addEventListener("pointerup", () => {
      if (!drag) return;
      const { moved, onImg } = drag;
      drag = null;
      stage.classList.remove("panning");
      // a plain click on the backdrop closes; on the image it is left to dblclick
      if (!moved && !onImg) close();
    });
    stage.addEventListener("pointercancel", () => { drag = null; stage.classList.remove("panning"); });

    document.addEventListener("keydown", e => {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") zoomAt(s * STEP);
      else if (e.key === "-") zoomAt(s / STEP);
      else if (e.key === "0") zoomAt(1);
      else if (e.key === "Tab") {
        // keep focus inside the dialog
        const f = Array.from(lb.querySelectorAll("button"));
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  }
})();
