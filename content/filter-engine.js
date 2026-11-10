/**
 * SearchGuard - Filter Engine
 * Интеллектуальный анализатор текста, URL и эвристический механизм фильтрации контента
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};

  const DefaultRules = root.SearchGuard.DefaultRules;

  class FilterEngine {
    constructor(settings = {}) {
      this.updateRules(settings);
    }

    /**
     * Обновить активные словари и правила в соответствии с настройками пользователя
     * @param {Object} settings
     */
    updateRules(settings = {}) {
      this.settings = settings;

      // Пользовательские и стандартные ключевые слова
      this.highKeywords = new Set([
        ...DefaultRules.HIGH_SEVERITY_KEYWORDS,
        ...(settings.customKeywords || []).map(k => k.trim().toLowerCase())
      ]);

      this.mediumKeywords = new Set(DefaultRules.MEDIUM_SEVERITY_KEYWORDS);

      // Блокируемые домены
      this.adultDomains = new Set([
        ...DefaultRules.ADULT_DOMAINS,
        ...(settings.customBlockedDomains || []).map(d => d.trim().toLowerCase())
      ]);

      // Доверенные домены (Whitelist сайтов)
      this.whitelistedDomains = new Set(
        (settings.whitelistedDomains || []).map(d => d.trim().toLowerCase())
      );

      // Разрешённые фразы (Whitelist запросов и контекстов)
      this.whitelistedPhrases = new Set([
        ...(DefaultRules.DEFAULT_SETTINGS.whitelistedPhrases || []),
        ...(settings.whitelistedPhrases || []).map(p => p.trim().toLowerCase())
      ]);

      this.adultTlds = DefaultRules.ADULT_TLDS;

      // Порог скоринга
      this.threshold = typeof settings.threshold === 'number' && !isNaN(settings.threshold) ? settings.threshold : 6;
    }

    /**
     * Оценка элемента выдачи на содержание контента 18+
     * @param {{ title: string, snippet: string, url: string, rawText?: string }} itemData
     * @returns {{ shouldFilter: boolean, reason: string, matchedTerms: string[], score: number }}
     */
    evaluate(itemData) {
      if (!this.settings || !this.settings.enabled || !this.settings.domFiltering) {
        return { shouldFilter: false, reason: '', matchedTerms: [], score: 0 };
      }

      const title = itemData.title || '';
      const snippet = itemData.snippet || '';
      const url = itemData.url || '';
      const rawText = itemData.rawText || `${title} ${snippet}`;

      // 1. Проверка белого списка доменов
      if (url && this._isWhitelistedDomain(url)) {
        return { shouldFilter: false, reason: 'Домен в белом списке', matchedTerms: [], score: 0 };
      }

      // 2. Проверка белого списка фраз (защита от ложных срабатываний в образовательных/исторических контекстах)
      if (this._isWhitelistedPhrase(rawText, title)) {
        return { shouldFilter: false, reason: 'Фраза в белом списке исключений', matchedTerms: [], score: 0 };
      }

      // 3. Проверка URL на известные взрослые домены
      if (url) {
        const domainMatch = this._checkAdultDomain(url);
        if (domainMatch) {
          return {
            shouldFilter: true,
            reason: `Заблокированный домен (${domainMatch})`,
            matchedTerms: [domainMatch],
            score: 100
          };
        }

        // Проверка зон первого уровня (.xxx, .porn) строго по хосту
        const tldMatch = this._checkAdultTld(url);
        if (tldMatch) {
          return {
            shouldFilter: true,
            reason: `Взрослая доменная зона (${tldMatch})`,
            matchedTerms: [tldMatch],
            score: 100
          };
        }
      }

      // 4. Нормализация текста и деобфускация
      const normalizedText = this._normalizeText(rawText);

      const matchedTerms = [];
      let score = 0;

      // 5. Проверка ключевых слов высокой опасности с учётом границ слов
      for (const kw of this.highKeywords) {
        if (this._hasKeywordMatch(normalizedText, kw)) {
          // Изолированный токен 'xxx' без порнографического контекста снижает вес (защита римских чисел и названий)
          if (kw === 'xxx' && !this._hasAdultContext(normalizedText)) {
            score += 3;
            matchedTerms.push('xxx (контекст)');
          } else {
            score += 10;
            matchedTerms.push(kw);
          }
        }
      }

      // 6. Проверка контекстных маркеров средней опасности
      for (const kw of this.mediumKeywords) {
        if (this._hasKeywordMatch(normalizedText, kw)) {
          score += 3;
          matchedTerms.push(kw);
        }
      }

      const shouldFilter = score >= this.threshold;
      let reason = '';
      if (shouldFilter) {
        reason = `Обнаружены маркеры 18+: ${matchedTerms.slice(0, 3).join(', ')}`;
      }

      return {
        shouldFilter,
        reason,
        matchedTerms,
        score
      };
    }

    /**
     * Проверка домена по белому списку
     * @private
     */
    _isWhitelistedDomain(url) {
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        const hostname = parsed.hostname.toLowerCase();
        for (const white of this.whitelistedDomains) {
          if (hostname === white || hostname.endsWith(`.${white}`)) {
            return true;
          }
        }
      } catch (e) {
        // Некорректный URL
      }
      return false;
    }

    /**
     * Проверка текста по белому списку разрешённых фраз
     * @private
     */
    _isWhitelistedPhrase(rawText, title) {
      const lower = `${rawText} ${title}`.toLowerCase();
      for (const phrase of this.whitelistedPhrases) {
        if (phrase && lower.includes(phrase)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Проверка URL на порно-домены
     * @private
     */
    _checkAdultDomain(url) {
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        const hostname = parsed.hostname.toLowerCase();
        for (const domain of this.adultDomains) {
          if (hostname === domain || hostname.endsWith(`.${domain}`)) {
            return domain;
          }
        }
      } catch (e) {
        // Fallback для относительных URL
        const lowerUrl = url.toLowerCase();
        for (const domain of this.adultDomains) {
          if (lowerUrl.includes(domain)) {
            return domain;
          }
        }
      }
      return null;
    }

    /**
     * Проверка доменной зоны строго по hostname (исключает ложные срабатывания на имена файлов в URL)
     * @private
     */
    _checkAdultTld(url) {
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        const hostname = parsed.hostname.toLowerCase();
        for (const tld of this.adultTlds) {
          if (hostname.endsWith(tld)) {
            return tld;
          }
        }
      } catch (e) {}
      return null;
    }

    /**
     * Поиск совпадения слова или фразы с проверкой границ слов (исключает "аналитика" -> "анал")
     * @private
     */
    _hasKeywordMatch(text, keyword) {
      if (!keyword || !text) return false;

      // Если ключевая фраза содержит пробел, ищем вхождение фразы
      if (keyword.includes(' ')) {
        return text.includes(keyword);
      }

      // Для отдельных слов требуем совпадения по границам слов (\b или знакам препинания/пробелам)
      const escaped = this._escapeRegex(keyword);
      const regex = new RegExp(`(^|[^a-zа-яё0-9])${escaped}([^a-zа-яё0-9]|$)`, 'i');
      return regex.test(text);
    }

    /**
     * Дополнительный контекст для неоднозначных маркеров (например, 'xxx')
     * @private
     */
    _hasAdultContext(text) {
      const adultMarkers = ['video', 'видео', 'порно', 'porn', 'tube', 'sex', 'секс', 'free', 'online', 'онлайн', 'movies', 'фильм'];
      for (const m of adultMarkers) {
        if (text.includes(m)) return true;
      }
      return false;
    }

    /**
     * Деобфускация и нормализация leetspeak
     * Обрабатывает подмены символов в словах (p0rn -> porn, s3x -> sex, p*r*n -> prn)
     * Не ломает изолированные числа (2024, 100, 3.0)
     * @private
     */
    _normalizeText(text) {
      if (!text) return '';
      let norm = text.toLowerCase();

      // 1. Деобфускация разделителей внутри слов (п.о.р.н.о или p*o*r*n)
      norm = norm.replace(/([a-zа-яё])[\*\._\-\+]+([a-zа-яё])/gi, '$1$2');

      // 2. Leet-таблица: замена подменённых символов в словах, содержащих буквы
      // Заменяем цифры на буквы только если они окружены буквами (напр. s3x, p0rn, 4n4l),
      // сохраняя обычные числа и даты неповреждёнными (напр. "2024 год" не превращается в "zoza")
      norm = norm.replace(/([a-zа-яё])0([a-zа-яё])/g, '$1o$2');
      norm = norm.replace(/([a-zа-яё])1([a-zа-яё])/g, '$1i$2');
      norm = norm.replace(/([a-zа-яё])3([a-zа-яё])/g, '$1e$2');
      norm = norm.replace(/([a-zа-яё])4([a-zа-яё])/g, '$1a$2');
      norm = norm.replace(/([a-zа-яё])5([a-zа-яё])/g, '$1s$2');
      norm = norm.replace(/@/g, 'a');
      norm = norm.replace(/\$/g, 's');

      // 3. Замена частых начальных подмен (0xxx, 1xxx)
      norm = norm.replace(/\bp0rn\b/g, 'porn');
      norm = norm.replace(/\bs3x\b/g, 'sex');
      norm = norm.replace(/\b4n4l\b/g, 'anal');

      return norm;
    }

    _escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }

  root.SearchGuard.FilterEngine = FilterEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
