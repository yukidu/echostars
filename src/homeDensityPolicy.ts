const STYLE_ID = 'echostars-home-density-policy';
const ROOT_CLASS = 'echostars-home-density';
const HOME_GRID_SELECTOR = '.audio-card-grid';

function installHomeDensityStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* 首頁專用緊密版面；切換到其他頁面時不套用。 */
    html.${ROOT_CLASS} main {
      padding-top: 0.55rem !important;
    }

    html.${ROOT_CLASS} main > .space-y-4 > * + * {
      margin-top: 0.5rem !important;
    }

    html.${ROOT_CLASS} main > .space-y-4 p,
    html.${ROOT_CLASS} main > .space-y-4 span,
    html.${ROOT_CLASS} main > .space-y-4 button,
    html.${ROOT_CLASS} main > .space-y-4 input {
      line-height: 1.1 !important;
    }

    html.${ROOT_CLASS} main > .space-y-4 > div:first-child input,
    html.${ROOT_CLASS} main > .space-y-4 > div:first-child > button {
      padding-top: 0.45rem !important;
      padding-bottom: 0.45rem !important;
    }

    html.${ROOT_CLASS} .sort-toolbar {
      gap: 0.2rem !important;
      padding-top: 0 !important;
    }

    html.${ROOT_CLASS} .sort-toolbar button {
      padding-top: 0.2rem !important;
      padding-bottom: 0.2rem !important;
      line-height: 1 !important;
    }

    html.${ROOT_CLASS} .audio-card-grid {
      gap: 0.35rem !important;
      padding-top: 0.1rem !important;
    }

    /* 音檔資訊卡：縮短所有垂直空白，但保留原本按鈕可點擊面積。 */
    html.${ROOT_CLASS} .audio-card {
      padding-top: 0.4rem !important;
      padding-bottom: 0.4rem !important;
      padding-left: 0.5rem !important;
    }

    html.${ROOT_CLASS} .audio-card > div {
      gap: 0.5rem !important;
    }

    html.${ROOT_CLASS} .audio-card h3 {
      line-height: 1.05 !important;
      margin: 0 !important;
    }

    html.${ROOT_CLASS} .audio-card p {
      line-height: 1.05 !important;
      margin-top: 0.1rem !important;
      margin-bottom: 0 !important;
    }

    html.${ROOT_CLASS} .audio-card .mt-1 {
      margin-top: 0.2rem !important;
    }

    html.${ROOT_CLASS} .audio-card .border-t {
      padding-top: 0.25rem !important;
      gap: 0.15rem !important;
    }

    html.${ROOT_CLASS} .audio-card .reaction-button {
      padding-top: 0.15rem !important;
      padding-bottom: 0.15rem !important;
      gap: 0.3rem !important;
      line-height: 1 !important;
    }

    html.${ROOT_CLASS} .audio-card .rating-star {
      padding: 0.1rem !important;
    }

    html.${ROOT_CLASS} .audio-card [class*="rounded-md"] {
      line-height: 1 !important;
    }

    html.${ROOT_CLASS} main > footer {
      margin-top: 1.5rem !important;
      padding-top: 0.65rem !important;
      line-height: 1.05 !important;
    }

    @media (max-width: 639px) {
      html.${ROOT_CLASS} main {
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
      }

      html.${ROOT_CLASS} .audio-card {
        padding-top: 0.35rem !important;
        padding-bottom: 0.35rem !important;
        padding-left: 0.4rem !important;
      }

      html.${ROOT_CLASS} .audio-card > div {
        gap: 0.4rem !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function syncHomeDensityState() {
  const onHomePlaylist = Boolean(document.querySelector(HOME_GRID_SELECTOR));
  document.documentElement.classList.toggle(ROOT_CLASS, onHomePlaylist);
}

installHomeDensityStyles();
syncHomeDensityState();

const observer = new MutationObserver(syncHomeDensityState);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener('pageshow', syncHomeDensityState);
