const UPLOAD_PRESENTATION_STYLE_ID = 'echostars-upload-presentation-v51';

const normalizeText = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();

function installUploadPresentationStyle() {
  if (document.getElementById(UPLOAD_PRESENTATION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = UPLOAD_PRESENTATION_STYLE_ID;
  style.textContent = `
    @media (min-width: 768px) {
      .upload-modal-overlay > div {
        max-width: 64rem !important;
      }
    }

    #track-upload-form[data-upload-presentation="1"] {
      display: grid !important;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 1rem !important;
    }

    #track-upload-form[data-upload-presentation="1"]::before {
      content: '';
      grid-column: 1 / -1;
      grid-row: 1;
      height: 0;
    }

    #track-upload-form[data-upload-presentation="1"] > * {
      margin-top: 0 !important;
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-error="1"] {
      grid-column: 1 / -1;
      grid-row: 1;
      z-index: 1;
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-cover-section="1"],
    #track-upload-form[data-upload-presentation="1"] [data-upload-fields-grid="1"] {
      display: contents !important;
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-cover-label="1"] {
      grid-column: 1 / 3;
      grid-row: 2;
      align-self: end;
      margin: 0 !important;
      padding: .75rem .75rem .25rem;
      border: 1px solid rgb(226 232 240);
      border-bottom: 0;
      border-radius: 1rem 1rem 0 0;
      background: rgb(248 250 252 / .82);
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-cover-selected="1"] {
      grid-column: 1 / 3;
      grid-row: 3;
      align-self: stretch;
      margin: 0 !important;
      padding: .25rem .75rem .75rem;
      border: 1px solid rgb(226 232 240);
      border-top: 0;
      border-radius: 0 0 1rem 1rem;
      background: rgb(248 250 252 / .82);
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-audio="1"] {
      grid-column: 3 / 5;
      grid-row: 2 / span 2;
      align-self: stretch;
      padding: .75rem;
      border: 1px solid rgb(226 232 240);
      border-radius: 1rem;
      background: rgb(248 250 252 / .82);
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-vip="1"] {
      grid-column: 5 / 7 !important;
      grid-row: 2 / span 2;
      align-self: stretch;
      margin: 0 !important;
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-cover-library="1"] {
      grid-column: 1 / -1;
      grid-row: 4;
      margin: 0 !important;
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-standard="1"],
    #track-upload-form[data-upload-presentation="1"] [data-upload-categories="1"],
    #track-upload-form[data-upload-presentation="1"] [data-upload-keywords="1"] {
      grid-column: 1 / -1;
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-fields-grid="1"] > :not([data-upload-vip="1"]) {
      grid-column: span 3;
    }

    #track-upload-form[data-upload-presentation="1"] [data-upload-keyword-add="1"] > svg {
      display: none !important;
    }

    .dark #track-upload-form[data-upload-presentation="1"] [data-upload-cover-label="1"],
    .dark #track-upload-form[data-upload-presentation="1"] [data-upload-cover-selected="1"],
    .dark #track-upload-form[data-upload-presentation="1"] [data-upload-audio="1"] {
      border-color: rgb(51 65 85);
      background: rgb(15 23 42 / .55);
    }

    @media (max-width: 639px) {
      #track-upload-form[data-upload-presentation="1"] {
        grid-template-columns: minmax(0, 1fr);
      }

      #track-upload-form[data-upload-presentation="1"] [data-upload-cover-label="1"] {
        grid-column: 1;
        grid-row: 2;
      }

      #track-upload-form[data-upload-presentation="1"] [data-upload-cover-selected="1"] {
        grid-column: 1;
        grid-row: 3;
      }

      #track-upload-form[data-upload-presentation="1"] [data-upload-audio="1"] {
        grid-column: 1;
        grid-row: 4;
      }

      #track-upload-form[data-upload-presentation="1"] [data-upload-vip="1"] {
        grid-column: 1 !important;
        grid-row: 5;
      }

      #track-upload-form[data-upload-presentation="1"] [data-upload-cover-library="1"] {
        grid-column: 1;
        grid-row: 6;
      }

      #track-upload-form[data-upload-presentation="1"] [data-upload-fields-grid="1"] > :not([data-upload-vip="1"]) {
        grid-column: 1 / -1;
      }
    }
  `;
  document.head.appendChild(style);
}

function directLabelText(element: Element) {
  const label = Array.from(element.children).find(child => child.tagName === 'LABEL');
  return normalizeText(label?.textContent);
}

function cleanKeywordSymbols(keywordSection: HTMLElement) {
  keywordSection.querySelectorAll<HTMLElement>('span').forEach(span => {
    const text = normalizeText(span.textContent);
    if (/^#[^#]/.test(text) && span.children.length === 0) {
      span.textContent = text.replace(/^#\s*/, '');
    }
  });

  keywordSection.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    const text = normalizeText(button.textContent);

    if (text === '加入關鍵字') {
      button.dataset.uploadKeywordAdd = '1';
      return;
    }

    if (/^[✓+]\s*#/.test(text)) {
      const clean = text.replace(/^[✓+]\s*#\s*/, '');
      if (clean && button.textContent !== clean) button.textContent = clean;
    }
  });
}

function markUploadForm(form: HTMLFormElement) {
  form.dataset.uploadPresentation = '1';

  const directChildren = Array.from(form.children).filter((child): child is HTMLElement => child instanceof HTMLElement);

  directChildren.forEach(child => {
    delete child.dataset.uploadStandard;
  });

  const error = directChildren.find(child => child.classList.contains('bg-rose-50') || child.classList.contains('dark:bg-rose-950/60'));
  if (error) error.dataset.uploadError = '1';

  const audio = directChildren.find(child => directLabelText(child).startsWith('音訊檔案'));
  if (audio) audio.dataset.uploadAudio = '1';

  const cover = directChildren.find(child => directLabelText(child).startsWith('主講者封面照片'));
  if (cover) {
    cover.dataset.uploadCoverSection = '1';

    const coverChildren = Array.from(cover.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const coverLabel = coverChildren.find(child => child.tagName === 'LABEL');
    const coverSelected = coverChildren.find(child => child !== coverLabel && child.classList.contains('flex'));
    const coverLibrary = coverChildren.find(child => normalizeText(child.textContent).includes('R2 已有演講者照片'));

    if (coverLabel) coverLabel.dataset.uploadCoverLabel = '1';
    if (coverSelected) coverSelected.dataset.uploadCoverSelected = '1';
    if (coverLibrary) coverLibrary.dataset.uploadCoverLibrary = '1';
  }

  const categories = directChildren.find(child => directLabelText(child).startsWith('分類標籤'));
  if (categories) categories.dataset.uploadCategories = '1';

  const keywordSection = directChildren.find(child => normalizeText(child.textContent).includes('網友關鍵字'));
  if (keywordSection) {
    keywordSection.dataset.uploadKeywords = '1';
    cleanKeywordSymbols(keywordSection);
  }

  const fieldsGrid = directChildren.find(child =>
    child.classList.contains('grid') && normalizeText(child.textContent).includes('私秘 VIP 專屬音檔')
  );

  if (fieldsGrid) {
    fieldsGrid.dataset.uploadFieldsGrid = '1';
    const fieldChildren = Array.from(fieldsGrid.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const vip = fieldChildren.find(child => normalizeText(child.textContent).includes('私秘 VIP 專屬音檔'));
    if (vip) vip.dataset.uploadVip = '1';
  }

  directChildren.forEach(child => {
    if (
      child !== error &&
      child !== audio &&
      child !== cover &&
      child !== categories &&
      child !== keywordSection &&
      child !== fieldsGrid
    ) {
      child.dataset.uploadStandard = '1';
    }
  });
}

let applyingUploadPolicy = false;

function applyUploadPresentation(root: ParentNode = document) {
  if (applyingUploadPolicy) return;
  applyingUploadPolicy = true;
  try {
    const forms: HTMLFormElement[] = [];
    if (root instanceof HTMLFormElement && root.id === 'track-upload-form') forms.push(root);
    root.querySelectorAll<HTMLFormElement>('#track-upload-form').forEach(form => forms.push(form));
    forms.forEach(markUploadForm);
  } finally {
    applyingUploadPolicy = false;
  }
}

installUploadPresentationStyle();
applyUploadPresentation();

const uploadPresentationObserver = new MutationObserver(mutations => {
  if (applyingUploadPolicy) return;
  const relevant = mutations.some(mutation =>
    mutation.type === 'childList' ||
    (mutation.type === 'characterData' && mutation.target.parentElement?.closest('#track-upload-form'))
  );
  if (relevant) applyUploadPresentation();
});

uploadPresentationObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true
});
