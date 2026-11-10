/**
 * SearchGuard - Base Engine Adapter
 * Базовый абстрактный класс для адаптеров поисковых систем
 */
(function (root) {
  'use strict';

  root.SearchGuard.adapters = root.SearchGuard.adapters || {};

  const Constants = root.SearchGuard.Constants;

  class BaseEngineAdapter {
    constructor(engineId, displayName) {
      this.engineId = engineId;
      this.displayName = displayName;
    }

    /**
     * Проверяет, подходит ли данный адаптер для текущего URL страницы
     * @param {URL|Location} location
     * @returns {boolean}
     */
    matches(location) {
      throw new Error('Метод matches() должен быть реализован в наследнике');
    }

    /**
     * Возвращает коллекцию карточек результатов поиска из переданного корня DOM
     * @param {Document|Element} root
     * @returns {Element[]}
     */
    getResultElements(root = document) {
      throw new Error('Метод getResultElements() должен быть реализован в наследнике');
    }

    /**
     * Извлекает текстовую информацию и ссылки из элемента результата
     * @param {Element} element
     * @returns {{ title: string, snippet: string, url: string, rawText: string }}
     */
    extractData(element) {
      throw new Error('Метод extractData() должен быть реализован в наследнике');
    }

    /**
     * Применяет визуальную фильтрацию к элементу (Blur, Hide, Replace)
     * @param {Element} element
     * @param {string} mode 'blur' | 'hide' | 'replace'
     * @param {string} reason Причина блокировки
     * @param {Object} options Дополнительные опции
     */
    applyFilter(element, mode, reason, options = {}) {
      if (element.hasAttribute(Constants.DOM.PROCESSED_ATTR)) {
        return; // Уже обработан
      }
      element.setAttribute(Constants.DOM.PROCESSED_ATTR, 'true');

      if (mode === Constants.FILTER_MODES.HIDE) {
        element.classList.add(Constants.DOM.HIDE_CLASS);
        return;
      }

      if (mode === Constants.FILTER_MODES.REPLACE) {
        this._replaceElement(element, reason, options);
        return;
      }

      // По умолчанию: BLUR
      this._blurElement(element, reason, options);
    }

    /**
     * Реализация размытия с оверлеем
     * @private
     */
    _blurElement(element, reason, options) {
      // Добавляем класс обертки
      element.classList.add(Constants.DOM.WRAPPER_CLASS);

      // Оборачиваем содержимое во внутренний контейнер для размытия
      const innerWrapper = document.createElement('div');
      innerWrapper.className = Constants.DOM.BLUR_CLASS;
      while (element.firstChild) {
        innerWrapper.appendChild(element.firstChild);
      }
      element.appendChild(innerWrapper);

      // Создаем оверлей с предупреждением
      const overlay = document.createElement('div');
      overlay.className = Constants.DOM.OVERLAY_CLASS;
      overlay.innerHTML = `
        <div class="searchguard-overlay-icon">🛡️</div>
        <div class="searchguard-overlay-title">SearchGuard: Контент 18+ скрыт</div>
        <div class="searchguard-overlay-reason">${this._escapeHtml(reason || 'Обнаружены маркеры взрослого контента')}</div>
      `;

      if (options.showUnblurButton !== false) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'searchguard-overlay-btn';
        btn.innerHTML = '👁️ Показать результат';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          innerWrapper.classList.remove(Constants.DOM.BLUR_CLASS);
          overlay.remove();
        });
        overlay.appendChild(btn);
      }

      element.appendChild(overlay);
    }

    /**
     * Реализация замены карточки плейсхолдером
     * @private
     */
    _replaceElement(element, reason, options) {
      element.classList.add(Constants.DOM.HIDE_CLASS);

      const placeholder = document.createElement('div');
      placeholder.className = Constants.DOM.PLACEHOLDER_CLASS;
      placeholder.innerHTML = `
        <div class="searchguard-placeholder-content">
          <span style="font-size: 18px;">🛡️</span>
          <div class="searchguard-placeholder-text">
            <span class="searchguard-placeholder-title">Результат скрыт SearchGuard</span>
            <span class="searchguard-placeholder-sub">${this._escapeHtml(reason || 'Контент 18+')}</span>
          </div>
        </div>
      `;

      if (options.showUnblurButton !== false) {
        const revealBtn = document.createElement('button');
        revealBtn.type = 'button';
        revealBtn.className = 'searchguard-overlay-btn';
        revealBtn.style.color = '#0F172A';
        revealBtn.style.background = '#E2E8F0';
        revealBtn.style.borderColor = '#CBD5E1';
        revealBtn.innerText = 'Показать';
        revealBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          placeholder.remove();
          element.classList.remove(Constants.DOM.HIDE_CLASS);
        });
        placeholder.appendChild(revealBtn);
      }

      element.parentNode.insertBefore(placeholder, element.nextSibling);
    }

    /**
     * Восстановление исходного состояния элемента (снятие скрытия / размытия)
     * @param {Element} element
     */
    restoreElement(element) {
      if (!element || !element.hasAttribute(Constants.DOM.PROCESSED_ATTR)) {
        return;
      }

      // 1. Снимаем класс скрытия (Hide / Replace)
      element.classList.remove(Constants.DOM.HIDE_CLASS);

      // 2. Если был режим замены (Replace), удаляем плейсхолдер
      const sibling = element.nextSibling;
      if (sibling && sibling.classList && sibling.classList.contains(Constants.DOM.PLACEHOLDER_CLASS)) {
        sibling.remove();
      }

      // 3. Если был режим размытия (Blur), возвращаем DOM-структуру в исходное состояние
      element.classList.remove(Constants.DOM.WRAPPER_CLASS);
      const overlay = element.querySelector(`.${Constants.DOM.OVERLAY_CLASS}`);
      if (overlay) {
        overlay.remove();
      }

      const innerWrapper = element.querySelector(`.${Constants.DOM.BLUR_CLASS}`);
      if (innerWrapper) {
        while (innerWrapper.firstChild) {
          element.insertBefore(innerWrapper.firstChild, innerWrapper);
        }
        innerWrapper.remove();
      }

      // Снимаем маркер обработки
      element.removeAttribute(Constants.DOM.PROCESSED_ATTR);
    }

    /**
     * Восстановление всех обработанных элементов на странице
     * @param {Document|Element} root
     */
    restoreAll(root = document) {
      const processedElements = root.querySelectorAll(`[${Constants.DOM.PROCESSED_ATTR}]`);
      for (const el of processedElements) {
        this.restoreElement(el);
      }

      // Удаление любых оставшихся плейсхолдеров
      const placeholders = root.querySelectorAll(`.${Constants.DOM.PLACEHOLDER_CLASS}`);
      for (const ph of placeholders) {
        ph.remove();
      }
    }

    _escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  root.SearchGuard.adapters.BaseEngineAdapter = BaseEngineAdapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseEngineAdapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
