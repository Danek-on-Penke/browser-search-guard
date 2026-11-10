/**
 * SearchGuard - Storage Helper
 * Гибридное хранилище:
 * - Легковесные настройки и флаги -> chrome.storage.sync (синхронизация между устройствами)
 * - Объёмные списки доменов/слов и счётчики -> chrome.storage.local (обход лимита 8 КБ/элемент в sync)
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};

  const Constants = root.SearchGuard.Constants;
  const DefaultRules = root.SearchGuard.DefaultRules;

  // Ключи настроек, синхронизируемые через sync
  const SYNC_KEYS = [
    'enabled',
    'networkProtection',
    'blockAdultDomainsDirectly',
    'domFiltering',
    'filterMode',
    'blurIntensity',
    'showUnblurButton',
    'filterImages',
    'filterVideoSnippets',
    'threshold',
    'enabledEngines'
  ];

  // Ключи списков, сохраняемые исключительно в local из-за квот sync (~8КБ на элемент)
  const LOCAL_LIST_KEYS = [
    'customKeywords',
    'customBlockedDomains',
    'whitelistedDomains',
    'whitelistedPhrases'
  ];

  class StorageHelper {
    /**
     * Проверка доступности chrome.storage.sync
     * @private
     */
    static _hasSync() {
      return Boolean(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync);
    }

    /**
     * Получить все актуальные настройки расширения (sync + local + defaults)
     * @returns {Promise<Object>}
     */
    static async getSettings() {
      return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          resolve(JSON.parse(JSON.stringify(DefaultRules.DEFAULT_SETTINGS)));
          return;
        }

        const defaults = JSON.parse(JSON.stringify(DefaultRules.DEFAULT_SETTINGS));

        // Читаем из local (списки, статистика и legacy-настройки)
        chrome.storage.local.get(
          [
            Constants.STORAGE_KEYS.LISTS,
            Constants.STORAGE_KEYS.STATS,
            Constants.STORAGE_KEYS.SETTINGS,
            Constants.STORAGE_KEYS.PREFERENCES
          ],
          (localRes = {}) => {
            const localLists = localRes[Constants.STORAGE_KEYS.LISTS] || {};
            const localStats = localRes[Constants.STORAGE_KEYS.STATS] || {};
            const legacySettings = localRes[Constants.STORAGE_KEYS.SETTINGS] || {};

            // Если есть sync, читаем предпочтения из sync
            if (this._hasSync()) {
              chrome.storage.sync.get([Constants.STORAGE_KEYS.PREFERENCES], (syncRes = {}) => {
                const syncPrefs = syncRes[Constants.STORAGE_KEYS.PREFERENCES] || localRes[Constants.STORAGE_KEYS.PREFERENCES] || {};

                const merged = this._assembleSettings(defaults, syncPrefs, localLists, localStats, legacySettings);
                resolve(merged);
              });
            } else {
              const localPrefs = localRes[Constants.STORAGE_KEYS.PREFERENCES] || {};
              const merged = this._assembleSettings(defaults, localPrefs, localLists, localStats, legacySettings);
              resolve(merged);
            }
          }
        );
      });
    }

    /**
     * Сборка итогового объекта настроек с fallback
     * @private
     */
    static _assembleSettings(defaults, prefs, lists, stats, legacy) {
      return {
        ...defaults,
        ...legacy,
        ...prefs,
        ...lists,
        enabledEngines: {
          ...defaults.enabledEngines,
          ...(legacy.enabledEngines || {}),
          ...(prefs.enabledEngines || {})
        },
        stats: {
          ...defaults.stats,
          ...(legacy.stats || {}),
          ...stats
        }
      };
    }

    /**
     * Сохранение частичных изменений с автоматической маршрутизацией sync vs local
     * @param {Object} partialSettings
     * @returns {Promise<Object>}
     */
    static async saveSettings(partialSettings = {}) {
      const current = await this.getSettings();

      const syncPayload = {};
      const localListPayload = {};
      let statsPayload = null;

      for (const [key, value] of Object.entries(partialSettings)) {
        if (SYNC_KEYS.includes(key)) {
          syncPayload[key] = value;
        } else if (LOCAL_LIST_KEYS.includes(key)) {
          localListPayload[key] = value;
        } else if (key === 'stats') {
          statsPayload = value;
        }
      }

      const tasks = [];

      // 1. Сохранение списков в local
      if (Object.keys(localListPayload).length > 0) {
        const existingLists = {
          customKeywords: current.customKeywords,
          customBlockedDomains: current.customBlockedDomains,
          whitelistedDomains: current.whitelistedDomains,
          whitelistedPhrases: current.whitelistedPhrases
        };
        const updatedLists = { ...existingLists, ...localListPayload };
        tasks.push(
          new Promise((res) => {
            chrome.storage.local.set({ [Constants.STORAGE_KEYS.LISTS]: updatedLists }, res);
          })
        );
      }

      // 2. Сохранение статистики в local
      if (statsPayload) {
        tasks.push(
          new Promise((res) => {
            chrome.storage.local.set({ [Constants.STORAGE_KEYS.STATS]: statsPayload }, res);
          })
        );
      }

      // 3. Сохранение настроек в sync (с дублированием в local как offline-fallback)
      if (Object.keys(syncPayload).length > 0) {
        const existingPrefs = {};
        for (const k of SYNC_KEYS) {
          existingPrefs[k] = current[k];
        }
        const updatedPrefs = { ...existingPrefs, ...syncPayload };

        if (this._hasSync()) {
          tasks.push(
            new Promise((res) => {
              chrome.storage.sync.set({ [Constants.STORAGE_KEYS.PREFERENCES]: updatedPrefs }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                  // Fallback в local при ошибке квоты sync
                  chrome.storage.local.set({ [Constants.STORAGE_KEYS.PREFERENCES]: updatedPrefs }, res);
                } else {
                  // Сохраняем локальную копию
                  chrome.storage.local.set({ [Constants.STORAGE_KEYS.PREFERENCES]: updatedPrefs }, res);
                }
              });
            })
          );
        } else {
          tasks.push(
            new Promise((res) => {
              chrome.storage.local.set({ [Constants.STORAGE_KEYS.PREFERENCES]: updatedPrefs }, res);
            })
          );
        }
      }

      await Promise.all(tasks);
      return await this.getSettings();
    }

    /**
     * Увеличение счётчика отфильтрованных элементов (сохраняется в local)
     * @param {number} count
     * @returns {Promise<void>}
     */
    static async incrementFilteredCount(count = 1) {
      if (count <= 0) return;
      const settings = await this.getSettings();
      settings.stats.totalFilteredElements = (settings.stats.totalFilteredElements || 0) + count;
      await this.saveSettings({ stats: settings.stats });
    }

    /**
     * Сброс статистики
     * @returns {Promise<void>}
     */
    static async resetStats() {
      const resetStatsObj = {
        totalFilteredElements: 0,
        totalSafeSearchesEnforced: 0,
        lastResetDate: new Date().toISOString()
      };
      await this.saveSettings({ stats: resetStatsObj });
    }

    /**
     * Подписка на изменение настроек в chrome.storage (слушает и local, и sync)
     * @param {Function} callback (newSettings, oldSettings)
     */
    static onSettingsChanged(callback) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        let lastReportedJson = null;

        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName === 'local' || areaName === 'sync') {
            this.getSettings().then((currentSettings) => {
              const currentJson = JSON.stringify(currentSettings);
              if (currentJson !== lastReportedJson) {
                const oldSettings = lastReportedJson ? JSON.parse(lastReportedJson) : null;
                lastReportedJson = currentJson;
                callback(currentSettings, oldSettings);
              }
            });
          }
        });
      }
    }
  }

  root.SearchGuard.StorageHelper = StorageHelper;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageHelper;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
