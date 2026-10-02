export interface VisitorIdentity {
  deviceId: string;
  animal: string;
  emoji: string;
  adjective: string;
  fullName: string;
}

export const ANIMALS = [
  { name: '海豚', emoji: '🐬' },
  { name: '獵鷹', emoji: '🦅' },
  { name: '貓頭鷹', emoji: '🦉' },
  { name: '老虎', emoji: '🐯' },
  { name: '獅子', emoji: '🦁' },
  { name: '白兔', emoji: '🐰' },
  { name: '狐狸', emoji: '🦊' },
  { name: '熊貓', emoji: '🐼' },
  { name: '無尾熊', emoji: '🐨' },
  { name: '長頸鹿', emoji: '🦒' },
  { name: '大象', emoji: '🐘' },
  { name: '駿馬', emoji: '🐴' },
  { name: '刺蝟', emoji: '🦔' },
  { name: '企鵝', emoji: '🐧' },
  { name: '紅鶴', emoji: '🦩' },
  { name: '松鼠', emoji: '🐿️' },
  { name: '海豹', emoji: '🦭' },
  { name: '野狼', emoji: '🐺' },
  { name: '梅花鹿', emoji: '🦌' },
  { name: '綠頭鴨', emoji: '🦆' }
];

export const ADJECTIVES = [
  '爽朗的',
  '熱情的',
  '自信的',
  '溫暖的',
  '聰慧的',
  '勇敢的',
  '樂觀的',
  '踏實的',
  '敏銳的',
  '積極的',
  '幽默的',
  '堅毅的',
  '沉著的',
  '親切的',
  '謙遜的',
  '睿智的',
  '開朗的',
  '真誠的',
  '活力滿滿的',
  '充滿好奇的'
];

export const EXCITEMENT_ADJECTIVES = [
  '超棒的',
  '超精彩',
  '很感動',
  '印象深刻',
  '收穫滿滿',
  '醍醐灌頂',
  '充滿力量',
  '信心倍增',
  '直擊痛點',
  '視野大開',
  '熱血沸騰',
  '非常震撼',
  '必聽經典',
  '乾貨滿滿',
  '意猶未盡',
  '啟發極大',
  '思路清晰',
  '能量滿滿',
  '豁然開朗',
  '茅塞頓開'
];

const DEVICE_KEY = 'sq_visitor_identity_v1';

function createRandomVisitorIdentity(deviceId: string, previousFullName = ''): VisitorIdentity {
  let animalIndex = Math.floor(Math.random() * ANIMALS.length);
  let adjectiveIndex = Math.floor(Math.random() * ADJECTIVES.length);
  let animalObj = ANIMALS[animalIndex];
  let adjective = ADJECTIVES[adjectiveIndex];
  let fullName = `${adjective}${animalObj.name}`;

  // A refresh must visibly reroll the nickname, not occasionally land on the same combination.
  if (fullName === previousFullName && ANIMALS.length * ADJECTIVES.length > 1) {
    animalIndex = (animalIndex + 1) % ANIMALS.length;
    animalObj = ANIMALS[animalIndex];
    fullName = `${adjective}${animalObj.name}`;
    if (fullName === previousFullName) {
      adjectiveIndex = (adjectiveIndex + 1) % ADJECTIVES.length;
      adjective = ADJECTIVES[adjectiveIndex];
      fullName = `${adjective}${animalObj.name}`;
    }
  }

  return {
    deviceId,
    animal: animalObj.name,
    emoji: animalObj.emoji,
    adjective,
    fullName
  };
}

export function getOrCreateVisitor(): VisitorIdentity {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'guest-server',
      animal: '海豚',
      emoji: '🐬',
      adjective: '爽朗的',
      fullName: '爽朗的海豚'
    };
  }

  let deviceId = '';
  let previousFullName = '';
  const stored = localStorage.getItem(DEVICE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as VisitorIdentity;
      deviceId = parsed.deviceId || '';
      previousFullName = parsed.fullName || '';
    } catch {
      // Ignore malformed local data and create a new device identity below.
    }
  }

  if (!deviceId) {
    deviceId = 'dev-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  // The visible guest nickname intentionally changes on every page load, while
  // deviceId remains stable so likes/ratings/playback identity are unaffected.
  const identity = createRandomVisitorIdentity(deviceId, previousFullName);
  localStorage.setItem(DEVICE_KEY, JSON.stringify(identity));
  return identity;
}

export function getRandomExcitement(): string {
  return EXCITEMENT_ADJECTIVES[Math.floor(Math.random() * EXCITEMENT_ADJECTIVES.length)];
}
