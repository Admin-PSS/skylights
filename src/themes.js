import { festivalShow, demoShow, christmasShow, newYearShow } from './show/show.js';

/**
 * Occasion themes. Each bundles the show, what appears in the scene, the title-card texts,
 * the demo music and the personal-greeting wording. Add a new festival by adding an entry here.
 */
export const THEMES = {
  tazaungdaing: {
    name: '🌕 Tazaungdaing Full Moon',
    build: festivalShow,
    scene: { pagoda: true, moon: true, lanterns: true, balloons: 'few', snow: false, xmas: false, party: false },
    music: 'festival',
    title: {
      title: 'Happy Tazaungdaing',
      subtitle: 'တန်ဆောင်မုန်းလပြည့် · Festival of Lights',
      dateLine: 'Full Moon of Tazaungmon · 2026',
      endTitle: 'ကျေးဇူးတင်ပါတယ်',
      endSub: 'Thank you for watching',
    },
    greeting: { title: 'Happy Tazaungdaing, {to}' },
  },
  christmas: {
    name: '🎄 Merry Christmas',
    build: christmasShow,
    path: 'christmas/', // has its own link preview (public/christmas/)
    scene: { pagoda: false, moon: false, lanterns: false, balloons: 'off', snow: true, xmas: true, party: false },
    music: 'jingle',
    title: {
      title: 'Merry Christmas',
      subtitle: 'ပျော်ရွှင်ဖွယ် ခရစ္စမတ် · Season’s Greetings',
      dateLine: 'December {prev}',
      endTitle: 'Happy New Year {year}',
      endSub: 'Thank you for watching',
    },
    greeting: { title: 'Merry Christmas, {to}' },
  },
  newyear: {
    name: '🎆 Happy New Year',
    build: newYearShow,
    path: 'newyear/',
    scene: { pagoda: false, moon: false, lanterns: false, balloons: 'off', snow: false, xmas: false, party: true },
    music: 'festival',
    title: {
      title: 'Happy New Year {year}',
      subtitle: 'ပျော်ရွှင်ဖွယ် နှစ်သစ်ကူး · Welcome {year}',
      dateLine: 'New Year’s Eve · 31 December {prev}',
      endTitle: 'Happy New Year {year}',
      endSub: 'Thank you for watching',
    },
    greeting: { title: 'Happy New Year, {to}' },
  },
  city: {
    name: '🏙 City lights demo',
    build: demoShow,
    scene: { pagoda: false, moon: true, lanterns: false, balloons: 'off', snow: false, xmas: false, party: false },
    music: 'festival',
    title: {
      title: 'SkyLights',
      subtitle: 'A virtual drone light show',
      dateLine: '',
      endTitle: 'Thank you',
      endSub: 'Thank you for watching',
    },
    greeting: { title: 'Hello, {to}' },
  },
};

/** The theme for today's date: November → Tazaungdaing, Dec 1–26 → Christmas, Dec 27 – Jan 7 → New Year, otherwise the city show. */
export function themeForDate(d = new Date()) {
  const m = d.getMonth() + 1, day = d.getDate();
  if (m === 11) return 'tazaungdaing';
  if (m === 12 && day <= 26) return 'christmas';
  if (m === 12 || (m === 1 && day <= 7)) return 'newyear';
  return 'city';
}

/** Fill {year} / {prev} in theme texts. */
export function fillYear(text, year) {
  return String(text || '').replace(/\{year\}/g, year).replace(/\{prev\}/g, year - 1);
}

/** Local midnight that starts the next day. */
export function nextMidnight(now = new Date()) {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

const CHOICE_KEY = 'skylights.theme.choice';

/** Which theme to open with: a shared link wins, then the viewer's own pick for this season, then the date. */
export function initialTheme(params) {
  const fromLink = params.get('theme');
  if (fromLink && THEMES[fromLink]) return fromLink;
  const season = themeForDate();
  try {
    const saved = JSON.parse(localStorage.getItem(CHOICE_KEY) || 'null');
    if (saved && THEMES[saved.id] && saved.season === season) return saved.id;
  } catch { /* ignore */ }
  return season;
}

/** Remember a theme the viewer picked by hand (only until the season changes). */
export function rememberThemeChoice(id) {
  try { localStorage.setItem(CHOICE_KEY, JSON.stringify({ id, season: themeForDate() })); } catch { /* ignore */ }
}

/** A link that opens SkyLights with this theme and a personal greeting. */
export function personalLink(themeId, to, from) {
  const base = new URL('./', location.href);
  const path = THEMES[themeId]?.path;
  const u = new URL(path || './', base);
  if (!path) u.searchParams.set('theme', themeId);
  if (to) u.searchParams.set('to', to);
  if (from) u.searchParams.set('from', from);
  return u.toString();
}
