/**
 * SearchGuard - DeclarativeNetRequest Manager
 * Управление статическими и динамическими правилами сетевого уровня
 */
(function (root) {
  'use strict';

  root.SearchGuard = root.SearchGuard || {};

  const Constants = root.SearchGuard.Constants;

  class DnrManager {
    /**
     * Синхронизировать активность наборов правил с текущими настройками
     * @param {Object} settings
     */
    static async syncRulesets(settings) {
      if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateEnabledRulesets) {
        console.warn('[SearchGuard DNR] declarativeNetRequest API недоступен в данном контексте');
        return;
      }

      const enableRulesetIds = [];
      const disableRulesetIds = [];

      // SafeSearch правила и блокировка опасных поисковых запросов
      if (settings.enabled && settings.networkProtection) {
        enableRulesetIds.push(Constants.RULESET_IDS.SAFE_SEARCH);
        enableRulesetIds.push(Constants.RULESET_IDS.BLOCKED_QUERIES);
      } else {
        disableRulesetIds.push(Constants.RULESET_IDS.SAFE_SEARCH);
        disableRulesetIds.push(Constants.RULESET_IDS.BLOCKED_QUERIES);
      }

      // Блокировка доменов напрямую
      if (settings.enabled && settings.blockAdultDomainsDirectly) {
        enableRulesetIds.push(Constants.RULESET_IDS.BLOCKED_DOMAINS);
      } else {
        disableRulesetIds.push(Constants.RULESET_IDS.BLOCKED_DOMAINS);
      }

      try {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds,
          disableRulesetIds
        });
        console.log('[SearchGuard DNR] Наборы правил обновлены:', { enableRulesetIds, disableRulesetIds });
      } catch (err) {
        console.error('[SearchGuard DNR] Ошибка при переключении наборов правил:', err);
      }

      // Обновить пользовательские динамические домены
      await this.syncCustomBlockedDomains(settings);
    }

    /**
     * Синхронизация пользовательских блокируемых доменов через динамические правила DNR
     * @param {Object} settings
     */
    static async syncCustomBlockedDomains(settings) {
      if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.getDynamicRules) {
        return;
      }

      try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const removeRuleIds = existingRules.map(r => r.id);

        const addRules = [];
        if (settings.enabled && Array.isArray(settings.customBlockedDomains)) {
          let ruleIdCounter = 10000;
          for (const domain of settings.customBlockedDomains) {
            const cleanDomain = domain.trim().toLowerCase();
            if (cleanDomain) {
              addRules.push({
                id: ruleIdCounter++,
                priority: 3,
                action: { type: 'block' },
                condition: {
                  urlFilter: `||${cleanDomain}`,
                  resourceTypes: ['main_frame', 'sub_frame']
                }
              });
            }
          }
        }

        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds,
          addRules
        });
        console.log(`[SearchGuard DNR] Синхронизировано ${addRules.length} пользовательских правил`);
      } catch (err) {
        console.error('[SearchGuard DNR] Ошибка обновления динамических правил:', err);
      }
    }
  }

  root.SearchGuard.DnrManager = DnrManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DnrManager;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
