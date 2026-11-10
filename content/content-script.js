/**
 * SearchGuard - Content Script Main Orchestrator
 * Координирует сканирование DOM, обработку мутаций и взаимодействие с Background
 */
(function (root) {
  'use strict';

  const { Constants, StorageHelper, FilterEngine, adapters } = root.SearchGuard;

  // Доступные адаптеры поисковых систем (динамическая инициализация из глобального namespace)
  const ADAPTERS = [
    adapters && adapters.google ? new adapters.google() : null,
    adapters && adapters.yandex ? new adapters.yandex() : null,
    adapters && adapters.bing ? new adapters.bing() : null,
    adapters && adapters.duckduckgo ? new adapters.duckduckgo() : null
  ].filter(Boolean);

  class ContentScriptController {
    constructor() {
      this.adapter = null;
      this.filterEngine = null;
      this.settings = null;
      this.scannedSignatures = new WeakMap();
      this.filteredCount = 0;
      this.isScanScheduled = false;
      this.observer = null;
    }

    async init() {
      // 1. Определение подходящего адаптера
      this.adapter = ADAPTERS.find(a => a.matches(window.location));
      if (!this.adapter) {
        // Текущий сайт не является поддерживаемой поисковой системой
        return;
      }

      console.log(`[SearchGuard] Активирован адаптер: ${this.adapter.displayName}`);

      // 2. Получение настроек
      this.settings = await StorageHelper.getSettings();

      // Проверка активности расширения и конкретного поисковика
      if (!this.settings.enabled || !this.settings.domFiltering) {
        console.log('[SearchGuard] DOM-фильтрация отключена в настройках');
        return;
      }

      // Проверка белого списка доменов (если текущий сайт/поисковик добавлен в whitelist)
      const currentHost = window.location.hostname.toLowerCase();
      const isDomainWhitelisted = (this.settings.whitelistedDomains || []).some(d => {
        const white = d.trim().toLowerCase();
        return white && (currentHost === white || currentHost.endsWith(`.${white}`));
      });

      if (isDomainWhitelisted) {
        console.log(`[SearchGuard Whitelist] Пропущено: домен ${currentHost} в белом списке`);
        return;
      }

      const isEngineEnabled = this.settings.enabledEngines[this.adapter.engineId] !== false;
      if (!isEngineEnabled) {
        console.log(`[SearchGuard] Поисковик ${this.adapter.displayName} отключен пользователем`);
        return;
      }

      // 3. Инициализация движка фильтрации
      this.filterEngine = new FilterEngine(this.settings);

      // 4. Первичный запуск фильтрации по готовности DOM
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.runScan());
      } else {
        this.runScan();
      }

      // 5. Наблюдение за динамическими изменениями (Infinite scroll / AJAX)
      this.setupObserver();

      // 6. Подписка на обновление настроек
      this.setupSettingsWatcher();

      // 7. Слушатель прямых команд от Service Worker и Popup
      this.setupMessageListener();
    }

    /**
     * Запуск сканирования и фильтрации элементов
     */
    runScan() {
      if (!this.adapter || !this.filterEngine || !this.settings.enabled || !this.settings.domFiltering) {
        return;
      }

      const elements = this.adapter.getResultElements(document);
      let newlyFiltered = 0;

      for (const el of elements) {
        if (el.hasAttribute(Constants.DOM.PROCESSED_ATTR)) {
          continue;
        }

        const data = this.adapter.extractData(el);
        if (this.scannedSignatures.get(el) === data.rawText) {
          continue;
        }
        this.scannedSignatures.set(el, data.rawText);

        const evalResult = this.filterEngine.evaluate(data);

        if (evalResult.shouldFilter) {
          newlyFiltered++;
          this.filteredCount++;

          this.adapter.applyFilter(
            el,
            this.settings.filterMode,
            evalResult.reason,
            { showUnblurButton: this.settings.showUnblurButton }
          );

          console.warn(`[SearchGuard Blocked] ${evalResult.reason}:`, data.title || data.url);
        }
      }

      // Если были заблокированы новые элементы, отправляем отчёт в Background
      if (newlyFiltered > 0) {
        this.notifyBackground(newlyFiltered);
      }
    }

    /**
     * Планирование сканирования через requestIdleCallback / requestAnimationFrame
     */
    scheduleScan() {
      if (this.isScanScheduled) return;
      this.isScanScheduled = true;

      const run = () => {
        this.isScanScheduled = false;
        this.runScan();
      };

      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 350 });
      } else {
        window.requestAnimationFrame(run);
      }
    }

    /**
     * MutationObserver для отслеживания динамической выдачи
     */
    setupObserver() {
      this.observer = new MutationObserver((mutations) => {
        let hasRelevantChanges = false;
        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0) {
            hasRelevantChanges = true;
            break;
          }
        }

        if (hasRelevantChanges) {
          this.scheduleScan();
        }
      });

      // В режиме run_at: "document_start" document.body еще равен null.
      // Навешиваем observer на document.documentElement (<html>), чтобы ловить элементы
      // в потоке парсинга до их отрисовки и исключить мелькание нежелательного контента.
      const target = document.documentElement;
      if (target) {
        this.observer.observe(target, {
          childList: true,
          subtree: true
        });
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          this.observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
          });
        });
      }
    }

    /**
     * Отправка информации о блокировках в Background Service Worker
     */
    notifyBackground(count) {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: Constants.MESSAGES.PAGE_REPORT_FILTERED,
          count: count
        }, () => {
          if (chrome.runtime.lastError) {
            // Service Worker может спать, игнорируем ошибку порта
          }
        });
      }
    }

    /**
     * Восстановление исходного состояния DOM при отключении защиты
     */
    restoreAll() {
      if (this.adapter && typeof this.adapter.restoreAll === 'function') {
        this.adapter.restoreAll(document);
      }
      this.scannedSignatures = new WeakMap();
      this.filteredCount = 0;
      this.notifyBackground(0);
      console.log('[SearchGuard] DOM полностью восстановлен в исходное состояние');
    }

    /**
     * Отслеживание изменений настроек в реальном времени
     */
    setupSettingsWatcher() {
      StorageHelper.onSettingsChanged((newSettings, oldSettings) => {
        if (!newSettings) return;

        const wasActive = this.settings && this.settings.enabled && this.settings.domFiltering;
        const isNowActive = newSettings.enabled && newSettings.domFiltering;
        const modeChanged = this.settings && (this.settings.filterMode !== newSettings.filterMode);

        this.settings = newSettings;
        if (this.filterEngine) {
          this.filterEngine.updateRules(newSettings);
        }

        if (wasActive && !isNowActive) {
          // Защита выключена — возвращаем элементы в исходный вид
          this.restoreAll();
        } else if (modeChanged || (!wasActive && isNowActive)) {
          // Сменился режим сокрытия либо защиту включили снова
          this.restoreAll();
          this.scheduleScan();
        } else if (isNowActive) {
          this.scheduleScan();
        }
      });
    }

    /**
     * Слушатель прямых сообщений от Service Worker или Popup
     */
    setupMessageListener() {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (!message || !message.action) return false;

          switch (message.action) {
            case 'RESTORE_DOM':
            case 'DISABLE':
              this.restoreAll();
              sendResponse({ success: true, restored: true });
              return true;

            case 'RESCAN_DOM':
            case 'ENABLE':
              this.restoreAll();
              this.scheduleScan();
              sendResponse({ success: true, rescanned: true });
              return true;

            case 'GET_STATUS':
              sendResponse({
                active: Boolean(this.settings && this.settings.enabled && this.settings.domFiltering),
                filteredCount: this.filteredCount,
                engine: this.adapter ? this.adapter.displayName : null
              });
              return true;

            default:
              return false;
          }
        });
      }
    }
  }

  // Запуск контроллера
  const controller = new ContentScriptController();
  controller.init();

})(typeof globalThis !== 'undefined' ? globalThis : this);
