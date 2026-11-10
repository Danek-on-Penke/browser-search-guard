/**
 * SearchGuard - Shared Constants
 * Поддерживает запуск в Service Worker, Content Scripts и UI (Popup, Options)
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};

  root.SearchGuard.Constants = Object.freeze({
    // Идентификаторы расширения
    APP_NAME: 'SearchGuard',
    APP_VERSION: '1.0.0',

    // Режимы скрытия контента на странице
    FILTER_MODES: {
      BLUR: 'blur',       // Размытие с кнопкой показа по клику
      HIDE: 'hide',       // Полное скрытие элемента из DOM (display: none)
      REPLACE: 'replace'  // Замена на информационную плашку SearchGuard
    },

    // Типы сообщений для обмена между Content Script, Background и UI
    MESSAGES: {
      GET_SETTINGS: 'SG_GET_SETTINGS',
      SAVE_SETTINGS: 'SG_SAVE_SETTINGS',
      SETTINGS_UPDATED: 'SG_SETTINGS_UPDATED',
      UPDATE_BADGE: 'SG_UPDATE_BADGE',
      PAGE_REPORT_FILTERED: 'SG_PAGE_REPORT_FILTERED',
      RESET_STATS: 'SG_RESET_STATS',
      GET_PAGE_STATS: 'SG_GET_PAGE_STATS'
    },

    // Ключи в chrome.storage (sync vs local)
    STORAGE_KEYS: {
      PREFERENCES: 'searchguard_prefs', // chrome.storage.sync (флаги, режимы)
      LISTS: 'searchguard_lists',       // chrome.storage.local (объёмные списки доменов и слов)
      STATS: 'searchguard_stats',       // chrome.storage.local (часто обновляемая статистика)
      SETTINGS: 'searchguard_settings'  // legacy ключ для обратной совместимости
    },

    // ID статических наборов правил declarativeNetRequest
    RULESET_IDS: {
      SAFE_SEARCH: 'safesearch_rules',
      BLOCKED_DOMAINS: 'blocked_domains',
      BLOCKED_QUERIES: 'blocked_queries'
    },

    // Поисковые движки
    ENGINES: {
      GOOGLE: 'google',
      YANDEX: 'yandex',
      BING: 'bing',
      DUCKDUCKGO: 'duckduckgo'
    },

    // Цвета бейджа на иконке расширения
    BADGE_COLORS: {
      ACTIVE_SAFE: '#10B981',   // Зеленый (защита активна, чисто)
      ITEMS_BLOCKED: '#EF4444', // Красный (заблокированы элементы)
      INACTIVE: '#6B7280'       // Серый (защита отключена)
    },

    // CSS классы и атрибуты для Content Script
    DOM: {
      BLUR_CLASS: 'searchguard-blurred',
      HIDE_CLASS: 'searchguard-hidden',
      WRAPPER_CLASS: 'searchguard-wrapper',
      OVERLAY_CLASS: 'searchguard-overlay',
      PLACEHOLDER_CLASS: 'searchguard-placeholder',
      BADGE_CLASS: 'searchguard-badge',
      PROCESSED_ATTR: 'data-searchguard-processed',
      ACTION_UNBLUR: 'data-searchguard-unblur'
    }
  });

  // Экспорт для Node.js/CommonJS при тестировании
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.SearchGuard.Constants;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
