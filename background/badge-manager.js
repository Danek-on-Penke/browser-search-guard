/**
 * SearchGuard - Badge Manager
 * Управление счётчиком и индикатором на иконке расширения
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};

  const Constants = root.SearchGuard.Constants;

  class BadgeManager {
    /**
     * Обновить бейдж для конкретной вкладки или глобально
     * @param {number|null} tabId ID вкладки
     * @param {number} count Количество заблокированных элементов
     * @param {boolean} isEnabled Активна ли защита
     */
    static async updateBadge(tabId, count, isEnabled = true) {
      if (!chrome.action) return;

      const details = tabId ? { tabId } : {};

      if (!isEnabled) {
        await chrome.action.setBadgeText({ ...details, text: 'OFF' });
        await chrome.action.setBadgeBackgroundColor({
          ...details,
          color: Constants.BADGE_COLORS.INACTIVE
        });
        return;
      }

      if (count > 0) {
        await chrome.action.setBadgeText({
          ...details,
          text: count > 99 ? '99+' : String(count)
        });
        await chrome.action.setBadgeBackgroundColor({
          ...details,
          color: Constants.BADGE_COLORS.ITEMS_BLOCKED
        });
      } else {
        // Защита активна, угроз не обнаружено
        await chrome.action.setBadgeText({ ...details, text: '✓' });
        await chrome.action.setBadgeBackgroundColor({
          ...details,
          color: Constants.BADGE_COLORS.ACTIVE_SAFE
        });
      }
    }

    /**
     * Сбросить бейдж вкладки
     * @param {number} tabId
     */
    static async clearBadge(tabId) {
      if (!chrome.action) return;
      const details = tabId ? { tabId } : {};
      await chrome.action.setBadgeText({ ...details, text: '' });
    }
  }

  root.SearchGuard.BadgeManager = BadgeManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BadgeManager;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
