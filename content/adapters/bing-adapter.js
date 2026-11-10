/**
 * SearchGuard - Bing Search Engine Adapter
 * Адаптер поисковой выдачи Microsoft Bing
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};
  root.SearchGuard.adapters = root.SearchGuard.adapters || {};

  const BaseEngineAdapter = root.SearchGuard.adapters.BaseEngineAdapter;
  const Constants = root.SearchGuard.Constants;

  class BingAdapter extends BaseEngineAdapter {
    constructor() {
      super(Constants.ENGINES.BING, 'Bing');
    }

    matches(location) {
      return /(^|\.)bing\.com$/i.test(location.hostname);
    }

    getResultElements(root = document) {
      const results = [];

      // 1. Органические результаты Bing
      const organicItems = root.querySelectorAll('li.b_algo');
      for (const el of organicItems) {
        if (el.querySelector('h2 a')) {
          results.push(el);
        }
      }

      // 2. Картинки Bing Images
      const imageItems = root.querySelectorAll('div.img_cont, div.iuscp');
      for (const el of imageItems) {
        results.push(el);
      }

      return results;
    }

    extractData(element) {
      const titleEl = element.querySelector('h2 a, h2');
      const snippetEl = element.querySelector('div.b_caption p, .b_snippet');
      const linkEl = element.querySelector('h2 a, a[href]');
      const citeEl = element.querySelector('cite');
      const imgEl = element.querySelector('img');

      const title = titleEl ? titleEl.textContent.trim() : '';
      const snippet = snippetEl ? snippetEl.textContent.trim() : '';
      const url = linkEl ? linkEl.href : (citeEl ? citeEl.textContent.trim() : '');
      const altText = imgEl ? (imgEl.alt || imgEl.title || '') : '';

      return {
        title,
        snippet,
        url,
        rawText: `${title} ${snippet} ${altText}`.toLowerCase()
      };
    }
  }

  root.SearchGuard.adapters.bing = BingAdapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BingAdapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
