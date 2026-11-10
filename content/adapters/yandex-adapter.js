/**
 * SearchGuard - Yandex Search Engine Adapter
 * Адаптер поисковой выдачи Яндекс (ya.ru, yandex.ru, yandex.com, etc.)
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};
  root.SearchGuard.adapters = root.SearchGuard.adapters || {};

  const BaseEngineAdapter = root.SearchGuard.adapters.BaseEngineAdapter;
  const Constants = root.SearchGuard.Constants;

  class YandexAdapter extends BaseEngineAdapter {
    constructor() {
      super(Constants.ENGINES.YANDEX, 'Yandex');
    }

    matches(location) {
      return /(^|\.)(ya\.ru|yandex\.[a-z.]{2,6})$/i.test(location.hostname);
    }

    getResultElements(root = document) {
      const results = [];

      // 1. Органическая выдача Яндекса
      const organicItems = root.querySelectorAll('li.serp-item, div.serp-item:not(.serp-item_type_adv), div.Organic');
      for (const el of organicItems) {
        // Исключаем вложенные div.Organic, если родительский контейнер serp-item уже обрабатывается
        if (el.matches('div.Organic') && el.closest('li.serp-item, div.serp-item')) {
          continue;
        }
        // Проверяем, что элемент содержит заголовок или ссылку
        if (el.querySelector('.OrganicTitle-Link, .OrganicTitle-LinkText, h2, h3, a[href]')) {
          results.push(el);
        }
      }

      // 2. Блоки картинок Яндекс.Картинок
      const imageItems = root.querySelectorAll('div.serp-item_type_search, div.JustifierRow-Item');
      for (const el of imageItems) {
        results.push(el);
      }

      return results;
    }

    extractData(element) {
      const titleEl = element.querySelector('.OrganicTitle-LinkText, .OrganicTitle-Link, h2');
      const snippetEl = element.querySelector('.OrganicTextContent, .organic__text, .Organic-Content');
      const linkEl = element.querySelector('a.OrganicTitle-Link, a.Link, a[href]');
      const pathEl = element.querySelector('.Organic-Path, .Path');
      const imgEl = element.querySelector('img');

      const title = titleEl ? titleEl.textContent.trim() : '';
      const snippet = snippetEl ? snippetEl.textContent.trim() : '';
      const url = linkEl ? linkEl.href : (pathEl ? pathEl.textContent.trim() : '');
      const altText = imgEl ? (imgEl.alt || imgEl.title || '') : '';

      return {
        title,
        snippet,
        url,
        rawText: `${title} ${snippet} ${altText}`.toLowerCase()
      };
    }
  }

  root.SearchGuard.adapters.yandex = YandexAdapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = YandexAdapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
