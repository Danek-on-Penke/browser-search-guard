/**
 * SearchGuard - DuckDuckGo Engine Adapter
 * Адаптер поисковой выдачи DuckDuckGo
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};
  root.SearchGuard.adapters = root.SearchGuard.adapters || {};

  const BaseEngineAdapter = root.SearchGuard.adapters.BaseEngineAdapter;
  const Constants = root.SearchGuard.Constants;

  class DuckDuckGoAdapter extends BaseEngineAdapter {
    constructor() {
      super(Constants.ENGINES.DUCKDUCKGO, 'DuckDuckGo');
    }

    matches(location) {
      return /(^|\.)duckduckgo\.com$/i.test(location.hostname);
    }

    getResultElements(root = document) {
      const results = [];

      // 1. Органические результаты поиска DuckDuckGo
      const organicItems = root.querySelectorAll('article[data-testid="result"], li[data-layout="organic"]');
      for (const el of organicItems) {
        results.push(el);
      }

      // 2. Картинки в выдаче
      const imageItems = root.querySelectorAll('div.tile--img');
      for (const el of imageItems) {
        results.push(el);
      }

      return results;
    }

    extractData(element) {
      const titleEl = element.querySelector('h2 a, [data-testid="result-title-a"]');
      const snippetEl = element.querySelector('[data-result="snippet"], .OGPJDwb4hnvyFdhIS0Fd');
      const linkEl = element.querySelector('a[data-testid="result-title-a"], a[href]');
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

  root.SearchGuard.adapters.duckduckgo = DuckDuckGoAdapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DuckDuckGoAdapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
