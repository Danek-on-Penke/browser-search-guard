/**
 * SearchGuard - Default Rules & Lexicon
 * Словарь ключевых слов, шаблонов доменов и настройки по умолчанию
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};

  // Высоковероятные маркеры взрослого (18+) контента (RU/EN)
  const HIGH_SEVERITY_KEYWORDS = [
    // Русский язык
    'порно',
    'порнуха',
    'порнография',
    'порнографический',
    'секс видео',
    'интим фото',
    'интим видео',
    'голые девушки',
    'голые женщины',
    'голые сиськи',
    'минет',
    'куннилингус',
    'камшот',
    'дрочит',
    'дрочка',
    'мастурбация',
    'хентай',
    'хентайное',
    'ххх видео',
    'секс знакомства',
    'проститутки',
    'шлюхи',
    'эскортницы',
    'онлифанс сливы',
    'слив онлифанс',
    'вебкамы 18',
    'вебкам чат',

    // English
    'porn',
    'porno',
    'pornography',
    'pornographic',
    'xxx',
    'nsfw',
    'hentai',
    'sex video',
    'hardcore sex',
    'blowjob',
    'cumshot',
    'masturbation',
    'dildo',
    'creampie',
    'gangbang',
    'milf sex',
    'deepthroat',
    'bukkake',
    'onlyfans leak',
    'onlyfans leaked',
    'camgirl',
    'stripchat',
    'chaturbate',
    'xhamster',
    'pornhub',
    'xvideos',
    'redtube',
    'youporn',
    'brazzers',
    'erome',
    'adult toys'
  ];

  // Контекстные маркеры (требуют повышенного веса или совпадения с доменом/тегом)
  const MEDIUM_SEVERITY_KEYWORDS = [
    'эротика',
    'обнаженка',
    'обнаженные',
    'нюдесы',
    'нюдсы',
    'стриптиз',
    'эротический',
    'секс шоп',
    'интим магазин',
    'erotic',
    'erotica',
    'naked',
    'nude',
    'nudity',
    'sex shop',
    'adult video',
    'topless',
    'lingerie model',
    'fetish'
  ];

  // Известные домены взрослого контента для быстрой идентификации в выдаче
  const ADULT_DOMAINS = [
    'pornhub.com',
    'xvideos.com',
    'xnxx.com',
    'xhamster.com',
    'redtube.com',
    'youporn.com',
    'brazzers.com',
    'chaturbate.com',
    'stripchat.com',
    'bongacams.com',
    'livejasmin.com',
    'spankbang.com',
    'eporner.com',
    'hqporner.com',
    'tube8.com',
    'tnaflix.com',
    'thumbzilla.com',
    'beeg.com',
    'erome.com',
    'coomer.party',
    'coomer.su',
    'kemono.party',
    'kemono.su',
    'fapello.com',
    'daftsex.com',
    'porntrex.com',
    'pornone.com',
    'onlyfans.com'
  ];

  // Взрослые доменные зоны первого уровня (TLD)
  const ADULT_TLDS = [
    '.xxx',
    '.porn',
    '.adult',
    '.sex',
    '.sexy',
    '.cam'
  ];

  // Конфигурация по умолчанию
  const DEFAULT_SETTINGS = {
    // Мастер-переключатель
    enabled: true,

    // Уровень 1: Сетевая защита (declarativeNetRequest)
    networkProtection: true,
    blockAdultDomainsDirectly: false, // Блокировать прямой переход на взрослые домены

    // Уровень 2: DOM-фильтрация выдачи (Content Script)
    domFiltering: true,
    filterMode: 'blur', // 'blur' | 'hide' | 'replace'
    blurIntensity: 14,  // px
    showUnblurButton: true,
    filterImages: true,
    filterVideoSnippets: true,
    threshold: 6,       // Порог чувствительности скоринга (1-100)

    // Пользовательские правила и исключения
    customKeywords: [],
    customBlockedDomains: [],
    whitelistedDomains: [],
    whitelistedPhrases: [
      'сексуальное здоровье',
      'сексуальное воспитание',
      'сексуальное просвещение',
      'сексуальная ориентация',
      'сексуальные меньшинства',
      'половая система',
      'половое воспитание',
      'половое размножение',
      'половые клетки',
      'биологический пол',
      'анализ крови',
      'системный анализ',
      'математический анализ',
      'компьютерный анализ',
      'beethoven sextet',
      'string sextet',
      'super bowl xxx',
      'xxx лет',
      'xxx век',
      'xxx dynasty',
      'xxx съезд',
      'xxx олимпийские игры',
      'олимпиада xxx'
    ],

    // Активность для поисковых систем
    enabledEngines: {
      google: true,
      yandex: true,
      bing: true,
      duckduckgo: true
    },

    // Статистика
    stats: {
      totalFilteredElements: 0,
      totalSafeSearchesEnforced: 0,
      lastResetDate: new Date().toISOString()
    }
  };

  root.SearchGuard.DefaultRules = Object.freeze({
    HIGH_SEVERITY_KEYWORDS,
    MEDIUM_SEVERITY_KEYWORDS,
    ADULT_DOMAINS,
    ADULT_TLDS,
    DEFAULT_SETTINGS
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.SearchGuard.DefaultRules;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
