/**
 * SearchGuard - Google Search Engine Adapter
 * Адаптер поисковой выдачи Google (Web, Images, Videos)
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};
  root.SearchGuard.adapters = root.SearchGuard.adapters || {};

  const BaseEngineAdapter = root.SearchGuard.adapters.BaseEngineAdapter;
  const Constants = root.SearchGuard.Constants;

  class GoogleAdapter extends BaseEngineAdapter {
    constructor() {
      super(Constants.ENGINES.GOOGLE, 'Google');
    }

    matches(location) {
      return /(^|\.)google\.[a-z.]{2,6}$/i.test(location.hostname);
    }

    getResultElements(root = document) {
      const results = [];

      // 1. Обычные органические результаты поиска Google
      // Исключаем вложенные .g-blk и пустые блоки
      const organicItems = root.querySelectorAll('div.g:not(.g-blk), div[data-hveid]:not(.g)');
      for (const el of organicItems) {
        // Убеждаемся, что это реальный сниппет выдачи с заголовком и ссылкой
        if (el.querySelector('h3') && el.querySelector('a[href]')) {
          results.push(el);
        }
      }

      // 2. Блоки картинок Google Images
      const imageItems = root.querySelectorAll('div.isv-r, div[data-ri]');
      for (const el of imageItems) {
        results.push(el);
      }

      // 3. Блоки видео в выдаче
      const videoItems = root.querySelectorAll('div.RzdJxc');
      for (const el of videoItems) {
        results.push(el);
      }

      return results;
    }

    extractData(element) {
      const titleEl = element.querySelector('h3, [role="heading"]');
      const snippetEl = element.querySelector('div.VwiC3b, div[data-sncf], .yXK7lf');
      const linkEl = element.querySelector('a[href]');
      const imgEl = element.querySelector('img');

      const title = titleEl ? titleEl.textContent.trim() : '';
      const snippet = snippetEl ? snippetEl.textContent.trim() : '';
      const url = linkEl ? linkEl.href : '';
      const altText = imgEl ? (imgEl.alt || imgEl.title || '') : '';

      return {
        title,
        snippet,
        url,
        rawText: `${title} ${snippet} ${altText}`.toLowerCase()
      };
    }
  }

  root.SearchGuard.adapters.google = GoogleAdapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleAdapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
