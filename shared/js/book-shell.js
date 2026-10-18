/* Copyright (c) 2026 geniuskey and MusicBooks contributors. MIT. */
/* Monorepo navigation adapter. Imported books keep their own simulation engines. */
(function () {
  "use strict";
  const shelf = new URL("../../", document.currentScript.src).href;
  function connectShelf() {
    const bar = document.querySelector('[class$="-topbar"]');
    if (bar) {
      let link = bar.querySelector(".series-link");
      if (link) {
        link.href = shelf;
        const label = link.querySelector("span");
        if (label) label.textContent = "음악 서가";
      } else {
        link = document.createElement("a");
        const theme = bar.querySelector('[id$="-theme"]');
        link.className = (theme ? theme.className : "") + " music-shelf-link";
        link.href = shelf;
        link.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h5v14H4zM9 5h5v14H9zM17 6l3-1 3 14-3 1z"/></svg>';
        if (theme) theme.before(link); else bar.append(link);
      }
      link.classList.add("music-shelf-link");
      link.title = "MusicBooks · 음악 서가";
      link.setAttribute("aria-label", "음악 서가로 돌아가기");
    }
    const drawer = document.querySelector('[class$="-drawer"]');
    if (drawer && !drawer.querySelector(".music-shelf-return")) {
      const link = document.createElement("a");
      link.className = "music-shelf-return";
      link.href = shelf;
      link.textContent = "← 음악 서가로";
      drawer.append(link);
    }
  }
  if (document.readyState === "complete") connectShelf();
  else document.addEventListener("DOMContentLoaded", connectShelf, { once: true });
})();
