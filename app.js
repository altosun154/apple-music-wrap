(() => {
  "use strict";

  // ---------- DOM ----------
  const screens = {
    landing: document.getElementById("screen-landing"),
    loading: document.getElementById("screen-loading"),
    wrapped: document.getElementById("screen-wrapped"),
  };
  const loadingStatus = document.getElementById("loading-status");
  const slidesEl = document.getElementById("slides");
  const dotsEl = document.getElementById("slide-dots");
  const btnConnect = document.getElementById("btn-connect");
  const btnDemo = document.getElementById("btn-demo");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnRestart = document.getElementById("btn-restart");
  const landingError = document.getElementById("landing-error");
  const tokenCallout = document.getElementById("token-callout");
  const tokenInput = document.getElementById("token-input");
  const btnSaveToken = document.getElementById("btn-save-token");
  const slideTpl = document.getElementById("tpl-slide");

  const LIBRARY_PAGE_LIMIT = 100;
  const LIBRARY_MAX_PAGES = 25; // ~2500 songs, keeps this responsive & polite to the API

  let currentSlide = 0;
  let slideCount = 0;

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.dataset.active = key === name ? "true" : "false";
    });
  }

  function showError(message) {
    landingError.textContent = message;
    landingError.hidden = false;
  }

  // ---------- Developer token ----------
  function getDeveloperToken() {
    return (window.MUSICKIT_DEVELOPER_TOKEN && window.MUSICKIT_DEVELOPER_TOKEN.trim()) ||
      localStorage.getItem("mk_dev_token") ||
      "";
  }

  if (!getDeveloperToken()) {
    tokenCallout.hidden = false;
  }

  btnSaveToken.addEventListener("click", () => {
    const val = tokenInput.value.trim();
    if (!val) return;
    localStorage.setItem("mk_dev_token", val);
    tokenCallout.hidden = true;
    landingError.hidden = true;
  });

  // ---------- MusicKit bootstrap ----------
  let musicKitReadyPromise = null;

  function waitForMusicKitScript() {
    if (window.MusicKit) return Promise.resolve();
    return new Promise((resolve) => {
      document.addEventListener("musickitloaded", () => resolve(), { once: true });
    });
  }

  async function getMusicInstance() {
    if (musicKitReadyPromise) return musicKitReadyPromise;

    musicKitReadyPromise = (async () => {
      const developerToken = getDeveloperToken();
      if (!developerToken) {
        throw new Error("Add a MusicKit developer token first (see the box below the button).");
      }
      await waitForMusicKitScript();
      await window.MusicKit.configure({
        developerToken,
        app: {
          name: window.MUSICKIT_APP_NAME || "Apple Music Wrap",
          build: window.MUSICKIT_APP_BUILD || "1.0.0",
        },
      });
      return window.MusicKit.getInstance();
    })();

    return musicKitReadyPromise;
  }

  // ---------- Library fetch + aggregation ----------
  async function fetchLibrarySongs(music, onProgress) {
    const songs = [];
    let offset = 0;

    for (let page = 0; page < LIBRARY_MAX_PAGES; page++) {
      const result = await music.api.music("/v1/me/library/songs", {
        limit: LIBRARY_PAGE_LIMIT,
        offset,
      });
      const body = result && result.data ? result.data : result;
      const batch = (body && body.data) || [];
      songs.push(...batch);
      onProgress(songs.length);

      if (!body || !body.next || batch.length < LIBRARY_PAGE_LIMIT) break;
      offset += LIBRARY_PAGE_LIMIT;
    }

    return songs;
  }

  function artworkUrl(artwork, size) {
    if (!artwork || !artwork.url) return null;
    return artwork.url.replace("{w}", size).replace("{h}", size);
  }

  function buildWrappedStats(songs) {
    const genreCounts = new Map();
    const artistCounts = new Map(); // name -> { count, artwork }
    const albumCounts = new Map(); // key -> { name, artistName, count, artwork }
    const decadeCounts = new Map();

    let totalDurationMs = 0;
    let oldestAdded = null;
    let newestAdded = null;
    let longestSong = null;

    for (const song of songs) {
      const attrs = song.attributes || {};
      const artistName = attrs.artistName || "Unknown Artist";
      const albumName = attrs.albumName || "Unknown Album";
      const durationMs = attrs.durationInMillis || 0;
      const art = artworkUrl(attrs.artwork, 200);

      totalDurationMs += durationMs;

      (attrs.genreNames || []).forEach((g) => {
        if (!g || g === "Music") return;
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      });

      const artistEntry = artistCounts.get(artistName) || { name: artistName, count: 0, artwork: null };
      artistEntry.count += 1;
      if (!artistEntry.artwork && art) artistEntry.artwork = art;
      artistCounts.set(artistName, artistEntry);

      const albumKey = `${albumName}::${artistName}`;
      const albumEntry = albumCounts.get(albumKey) || { name: albumName, artistName, count: 0, artwork: null };
      albumEntry.count += 1;
      if (!albumEntry.artwork && art) albumEntry.artwork = art;
      albumCounts.set(albumKey, albumEntry);

      const year = parseInt((attrs.releaseDate || "").slice(0, 4), 10);
      if (!Number.isNaN(year) && year > 1900) {
        const decade = Math.floor(year / 10) * 10;
        decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
      }

      if (attrs.dateAdded) {
        if (!oldestAdded || attrs.dateAdded < oldestAdded.dateAdded) {
          oldestAdded = { name: attrs.name, artistName, dateAdded: attrs.dateAdded };
        }
        if (!newestAdded || attrs.dateAdded > newestAdded.dateAdded) {
          newestAdded = { name: attrs.name, artistName, dateAdded: attrs.dateAdded };
        }
      }

      if (!longestSong || durationMs > longestSong.durationMs) {
        longestSong = { name: attrs.name, artistName, durationMs };
      }
    }

    const topN = (map, n) => [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);

    return {
      totalSongs: songs.length,
      totalArtists: artistCounts.size,
      totalAlbums: albumCounts.size,
      totalDurationMs,
      topGenres: [...genreCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topArtists: topN(artistCounts, 5),
      topAlbums: topN(albumCounts, 5),
      decades: [...decadeCounts.entries()]
        .map(([decade, count]) => ({ decade, count }))
        .sort((a, b) => a.decade - b.decade),
      oldestAdded,
      newestAdded,
      longestSong,
      isMock: false,
    };
  }

  // ---------- Formatting ----------
  const fmtNum = (n) => (n || 0).toLocaleString();
  function fmtDuration(ms) {
    const totalSec = Math.round((ms || 0) / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  function fmtDate(iso) {
    if (!iso) return "unknown";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function rankItemHtml(rank, title, sub, countLabel, artwork) {
    const art = artwork
      ? `<img class="rank-art" src="${artwork}" alt="" loading="lazy" />`
      : `<div class="rank-art-fallback"></div>`;
    return `
      <div class="rank-item">
        <span class="rank-num">${rank}</span>
        ${art}
        <div class="rank-text">
          <div class="rank-title">${escapeHtml(title)}</div>
          ${sub ? `<div class="rank-sub">${escapeHtml(sub)}</div>` : ""}
        </div>
        <span class="rank-count">${escapeHtml(countLabel)}</span>
      </div>`;
  }

  // ---------- Slide definitions ----------
  function buildSlides(stats) {
    const days = stats.totalDurationMs / 86400000;
    const hours = stats.totalDurationMs / 3600000;
    const topGenre = stats.topGenres[0];
    const maxDecadeCount = Math.max(1, ...stats.decades.map((d) => d.count));

    const slides = [];

    slides.push({
      eyebrow: "The Big Picture",
      headline: "Your library holds a lot.",
      body: () => `
        <div class="stat-big">${fmtNum(stats.totalSongs)}</div>
        <div>songs across <strong>${fmtNum(stats.totalAlbums)}</strong> albums by <strong>${fmtNum(stats.totalArtists)}</strong> artists.</div>
      `,
    });

    slides.push({
      eyebrow: "Time Well Spent",
      headline: `That's ${days.toFixed(1)} days of music.`,
      body: () => `
        <div class="stat-big">${Math.round(hours).toLocaleString()}</div>
        <div>hours of music sitting in your library, saved up one song at a time.</div>
      `,
    });

    if (topGenre) {
      slides.push({
        eyebrow: "Your Sound",
        headline: `${topGenre.name} runs the show.`,
        body: () => `
          <div>${fmtNum(topGenre.count)} of your songs are tagged ${escapeHtml(topGenre.name)}. Here's the rest of your top genres:</div>
          <div class="genre-pills">
            ${stats.topGenres.map((g, i) => `<span class="genre-pill${i === 0 ? " top" : ""}">${escapeHtml(g.name)}</span>`).join("")}
          </div>
        `,
      });
    }

    if (stats.topArtists.length) {
      slides.push({
        eyebrow: "On Repeat",
        headline: "Your top 5 artists",
        body: () => `
          <div class="rank-list">
            ${stats.topArtists.map((a, i) => rankItemHtml(i + 1, a.name, null, `${fmtNum(a.count)} songs`, a.artwork)).join("")}
          </div>
        `,
      });
    }

    if (stats.topAlbums.length) {
      slides.push({
        eyebrow: "Deep Cuts",
        headline: "Albums you keep coming back to",
        body: () => `
          <div class="rank-list">
            ${stats.topAlbums.map((a, i) => rankItemHtml(i + 1, a.name, a.artistName, `${fmtNum(a.count)} songs`, a.artwork)).join("")}
          </div>
        `,
      });
    }

    if (stats.decades.length) {
      slides.push({
        eyebrow: "Through The Years",
        headline: "Your library, by decade",
        body: () => `
          <div class="bar-list">
            ${stats.decades.map((d) => `
              <div class="bar-row">
                <span class="bar-label">${d.decade}s</span>
                <span class="bar-track"><span class="bar-fill" style="width:${(d.count / maxDecadeCount) * 100}%"></span></span>
                <span class="bar-value">${fmtNum(d.count)}</span>
              </div>
            `).join("")}
          </div>
        `,
      });
    }

    if (stats.oldestAdded || stats.newestAdded || stats.longestSong) {
      slides.push({
        eyebrow: "Little Details",
        headline: "A few extras",
        body: () => `
          ${stats.oldestAdded ? `<div><strong>First song you ever saved:</strong> ${escapeHtml(stats.oldestAdded.name)} &mdash; ${escapeHtml(stats.oldestAdded.artistName)} <span style="opacity:.6">(${fmtDate(stats.oldestAdded.dateAdded)})</span></div>` : ""}
          ${stats.newestAdded ? `<div><strong>Most recent addition:</strong> ${escapeHtml(stats.newestAdded.name)} &mdash; ${escapeHtml(stats.newestAdded.artistName)} <span style="opacity:.6">(${fmtDate(stats.newestAdded.dateAdded)})</span></div>` : ""}
          ${stats.longestSong ? `<div><strong>Longest song in your library:</strong> ${escapeHtml(stats.longestSong.name)} <span style="opacity:.6">(${fmtDuration(stats.longestSong.durationMs)})</span></div>` : ""}
        `,
      });
    }

    slides.push({
      eyebrow: "Wrap It Up",
      headline: "Your Music Wrap",
      body: () => `
        <div class="share-canvas-wrap"><canvas id="share-canvas" width="600" height="900"></canvas></div>
        <button class="btn btn-primary" id="btn-download" style="max-width:none;">Download image</button>
      `,
      afterRender: (bodyEl) => {
        drawShareCard(bodyEl.querySelector("#share-canvas"), stats, { topGenre, days });
        bodyEl.querySelector("#btn-download").addEventListener("click", () => {
          const canvas = bodyEl.querySelector("#share-canvas");
          const link = document.createElement("a");
          link.download = "apple-music-wrap.png";
          link.href = canvas.toDataURL("image/png");
          link.click();
        });
      },
    });

    return slides;
  }

  function drawShareCard(canvas, stats, extra) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#fa233b");
    grad.addColorStop(0.55, "#8e54e9");
    grad.addColorStop(1, "#0a0a0c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 28px -apple-system, sans-serif";
    ctx.fillText("Apple Music Wrap", 40, 70);

    ctx.font = "800 54px -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    wrapText(ctx, `${extra.topGenre ? extra.topGenre.name : "Eclectic"} listener`, 40, 160, w - 80, 58);

    const lines = [
      `${fmtNum(stats.totalSongs)} songs`,
      `${fmtNum(stats.totalArtists)} artists`,
      `${fmtNum(stats.totalAlbums)} albums`,
      `${extra.days.toFixed(1)} days of music`,
      stats.topArtists[0] ? `Top artist: ${stats.topArtists[0].name}` : "",
    ].filter(Boolean);

    ctx.font = "600 30px -apple-system, sans-serif";
    let y = 420;
    lines.forEach((line) => {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(line, 40, y);
      y += 56;
    });

    ctx.font = "500 20px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("music.apple.com", 40, h - 40);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let curY = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, curY);
        line = word;
        curY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, curY);
  }

  // ---------- Slide rendering / navigation ----------
  function renderWrapped(stats) {
    const slides = buildSlides(stats);
    slideCount = slides.length;
    currentSlide = 0;

    slidesEl.innerHTML = "";
    dotsEl.innerHTML = "";

    slides.forEach((def, i) => {
      const node = slideTpl.content.cloneNode(true);
      const article = node.querySelector(".slide");
      article.dataset.index = String(i);
      node.querySelector(".slide-eyebrow").textContent = def.eyebrow;
      node.querySelector(".slide-headline").textContent = def.headline;
      const bodyEl = node.querySelector(".slide-body");
      bodyEl.innerHTML = def.body();
      slidesEl.appendChild(article);
      if (def.afterRender) def.afterRender(bodyEl);

      const dot = document.createElement("span");
      dot.className = "dot";
      dotsEl.appendChild(dot);
    });

    updateSlideView();
    showScreen("wrapped");
  }

  function updateSlideView() {
    [...slidesEl.children].forEach((el, i) => {
      el.dataset.current = i === currentSlide ? "true" : "false";
    });
    [...dotsEl.children].forEach((el, i) => {
      el.classList.toggle("active", i === currentSlide);
    });
    btnPrev.disabled = currentSlide === 0;
    btnNext.disabled = currentSlide === slideCount - 1;
  }

  function goTo(index) {
    currentSlide = Math.max(0, Math.min(slideCount - 1, index));
    updateSlideView();
  }

  btnPrev.addEventListener("click", () => goTo(currentSlide - 1));
  btnNext.addEventListener("click", () => goTo(currentSlide + 1));
  btnRestart.addEventListener("click", () => {
    showScreen("landing");
  });

  document.addEventListener("keydown", (e) => {
    if (screens.wrapped.dataset.active !== "true") return;
    if (e.key === "ArrowRight") goTo(currentSlide + 1);
    if (e.key === "ArrowLeft") goTo(currentSlide - 1);
  });

  let touchStartX = null;
  slidesEl.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  slidesEl.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) goTo(currentSlide + (dx < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  // ---------- Flows ----------
  btnDemo.addEventListener("click", () => {
    landingError.hidden = true;
    renderWrapped(window.MOCK_WRAPPED_STATS);
  });

  btnConnect.addEventListener("click", async () => {
    landingError.hidden = true;

    if (!getDeveloperToken()) {
      tokenCallout.hidden = false;
      showError("Add a developer token above first, then hit Connect again.");
      return;
    }

    showScreen("loading");
    loadingStatus.textContent = "Connecting to Apple Music…";

    try {
      const music = await getMusicInstance();
      if (!music.isAuthorized) {
        loadingStatus.textContent = "Waiting for authorization…";
        await music.authorize();
      }

      loadingStatus.textContent = "Reading your library…";
      const songs = await fetchLibrarySongs(music, (count) => {
        loadingStatus.textContent = `Reading your library… ${fmtNum(count)} songs so far`;
      });

      if (!songs.length) {
        showScreen("landing");
        showError("No songs found in your library — add some to Apple Music and try again.");
        return;
      }

      loadingStatus.textContent = "Wrapping it up…";
      const stats = buildWrappedStats(songs);
      renderWrapped(stats);
    } catch (err) {
      console.error(err);
      showScreen("landing");
      showError(err && err.message ? err.message : "Something went wrong connecting to Apple Music.");
    }
  });
})();
