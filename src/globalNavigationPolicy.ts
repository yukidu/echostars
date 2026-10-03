const STYLE_ID = 'echostars-global-navigation-policy';
const ROOT_CLASS = 'echostars-fixed-main-nav';
const NAV_SELECTOR = 'header.sticky.top-0';

function installGlobalNavigationStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --echostars-main-nav-height: 4rem;
    }

    @media (min-width: 640px) {
      :root {
        --echostars-main-nav-height: 72px;
      }
    }

    html.${ROOT_CLASS} ${NAV_SELECTOR} {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      z-index: 40 !important;
      transform: translateZ(0);
      -webkit-transform: translateZ(0);
    }

    html.${ROOT_CLASS} #root {
      padding-top: var(--echostars-main-nav-height);
    }
  `;
  document.head.appendChild(style);
}

function syncGlobalNavigationState() {
  const hasMainNav = Boolean(document.querySelector(NAV_SELECTOR));
  document.documentElement.classList.toggle(ROOT_CLASS, hasMainNav);
}

installGlobalNavigationStyle();
syncGlobalNavigationState();

const observer = new MutationObserver(() => syncGlobalNavigationState());
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener('pageshow', syncGlobalNavigationState);
window.addEventListener('resize', syncGlobalNavigationState);
