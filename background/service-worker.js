/**
 * SearchGuard - Background Service Worker (Manifest V3)
 * Координация сетевого уровня (declarativeNetRequest), хранилища и счётчиков
 */

// Загрузка зависимостей в контекст Service Worker
importScripts(
  '../shared/constants.js',
  '../shared/default-rules.js',
  '../shared/storage-helper.js',
  '../content/filter-engine.js',
  './dnr-manager.js',
  './badge-manager.js'
);

const { Constants, DefaultRules, StorageHelper, FilterEngine, DnrManager, BadgeManager } = self.SearchGuard;

// Карта локальных счётчиков для открытых вкладок: tabId -> count
const tabCounts = new Map();

/**
 * Инициализация расширения при установке или обновлении
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[SearchGuard] Установлено / Обновлено: ${details.reason} (v${Constants.APP_VERSION})`);

  // Проверяем / инициализируем настройки
  const settings = await StorageHelper.getSettings();

  // Синхронизируем правила сетевого уровня
  await DnrManager.syncRulesets(settings);

  // Глобальный статус бейджа
  await BadgeManager.updateBadge(null, 0, settings.enabled);
});

/**
 * Запуск браузера
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[SearchGuard] Service Worker запущен');
  const settings = await StorageHelper.getSettings();
  await DnrManager.syncRulesets(settings);
});

/**
 * Отслеживание изменений настроек в хранилище для мгновенного применения правил DNR
 */
StorageHelper.onSettingsChanged(async (newSettings, oldSettings) => {
  if (!newSettings) return;

  console.log('[SearchGuard] Настройки изменились, синхронизирую DNR...');
  await DnrManager.syncRulesets(newSettings);

  // Если защита была выключена глобально, обновляем бейдж
  if (oldSettings && oldSettings.enabled !== newSettings.enabled) {
    if (!newSettings.enabled) {
      await BadgeManager.updateBadge(null, 0, false);
    } else {
      await BadgeManager.updateBadge(null, 0, true);
    }
  }
});

/**
 * Очистка счётчиков при закрытии вкладки
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  tabCounts.delete(tabId);
});

/**
 * Очистка счётчика при навигации вкладки на новый URL
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabCounts.set(tabId, 0);
  }
});

/**
 * Обработка сообщений от Content Scripts и Popup/Options
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  const tabId = sender && sender.tab ? sender.tab.id : null;

  switch (message.action) {
    // Content Script сообщает о заблокированных элементах на странице
    case Constants.MESSAGES.PAGE_REPORT_FILTERED: {
      const addedCount = Number(message.count) || 0;
      if (tabId) {
        const currentCount = (tabCounts.get(tabId) || 0) + addedCount;
        tabCounts.set(tabId, currentCount);

        StorageHelper.getSettings().then((settings) => {
          BadgeManager.updateBadge(tabId, currentCount, settings.enabled);
        });

        // Увеличиваем общий персистентный счётчик в хранилище
        StorageHelper.incrementFilteredCount(addedCount);
      }
      sendResponse({ success: true });
      return true;
    }

    // Запрос статистики для конкретной вкладки (вызывается из Popup)
    case Constants.MESSAGES.GET_PAGE_STATS: {
      const targetTabId = message.tabId || tabId;
      const count = targetTabId ? (tabCounts.get(targetTabId) || 0) : 0;
      sendResponse({ tabId: targetTabId, filteredCount: count });
      return true;
    }

    // Получить актуальные настройки
    case Constants.MESSAGES.GET_SETTINGS: {
      StorageHelper.getSettings().then((settings) => {
        sendResponse({ settings });
      });
      return true; // Асинхронный ответ
    }

    // Сохранить настройки
    case Constants.MESSAGES.SAVE_SETTINGS: {
      StorageHelper.saveSettings(message.settings).then((updated) => {
        sendResponse({ success: true, settings: updated });
      });
      return true;
    }

    // Сброс статистики
    case Constants.MESSAGES.RESET_STATS: {
      StorageHelper.resetStats().then(() => {
        tabCounts.clear();
        sendResponse({ success: true });
      });
      return true;
    }

    default:
      return false;
  }
});
