/**
 * Anti-Bypass Metin Normalizasyon Motoru
 * Leetspeak, harf uzatmaları ve araya boşluk/işaret koyma taktiklerini normalize eder.
 */

const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '$': 's',
  '5': 's',
  '7': 't',
  '8': 'b',
  'v': 'u',
  'w': 'v'
};

// Yaygın Türkçe küfür/yasaklı kök kelimeler (kök bazında)
const BAD_WORDS = [
  'amk', 'aq', 'orospu', 'piç', 'pic', 'sik', 'siktir', 'yarrak', 'yarak',
  'göt', 'got', 'kahpe', 'oç', 'oc', 'amcık', 'amcik', 'pezevenk', 'ibne',
  'taşak', 'tasak', 'döl', 'dol', 'meme'
];

// Oltalama (Scam/Phishing) alan adı kalıpları
const SCAM_PATTERNS = [
  /discorcl\.gift/i,
  /dlscord\.com/i,
  /discord-nitro/i,
  /steamcommunlty/i,
  /free-nitro/i,
  /nitro-gift/i,
  /discordapp\.click/i,
  /discord-give/i
];

function normalizeText(text) {
  if (!text) return '';
  let cleaned = text.toLowerCase();

  // 1. Leetspeak çözümleme
  cleaned = cleaned.replace(/[01!|34@$578vw]/g, (char) => LEET_MAP[char] || char);

  // 2. Türkçe karakter eşleme
  cleaned = cleaned
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

  // 3. Noktalama, boşluk ve özel simgeleri temizleme
  const noSymbols = cleaned.replace(/[^a-z]/g, '');

  // 4. Harf uzatmalarını sadeleştirme (örn: sssiiikkk -> sik)
  const deDuplicated = noSymbols.replace(/(.)\1+/g, '$1');

  return {
    raw: text,
    originalCleaned: cleaned,
    noSymbols,
    deDuplicated
  };
}

function checkCurse(text) {
  const norm = normalizeText(text);

  for (const word of BAD_WORDS) {
    // Tam veya kök eşleşme kontrolü
    if (
      norm.noSymbols.includes(word) ||
      norm.deDuplicated.includes(word) ||
      norm.originalCleaned.split(/\s+/).some(w => w === word)
    ) {
      return { hasCurse: true, word };
    }
  }

  return { hasCurse: false };
}

function checkScam(text) {
  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test(text)) {
      return { isScam: true, pattern: pattern.toString() };
    }
  }
  return { isScam: false };
}

module.exports = {
  normalizeText,
  checkCurse,
  checkScam,
  BAD_WORDS,
  SCAM_PATTERNS
};

