/**
 * SearchGuard - Popup Controller
 */
(function () {
  'use strict';

  const { Constants, StorageHelper } = window.SearchGuard;

  // DOM элементы
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const masterToggle = document.getElementById('masterToggle');
  const networkToggle = document.getElementById('networkToggle');
  const domToggle = document.getElementById('domToggle');
  const modeSection = document.getElementById('modeSection');
  const segmentBtns = document.querySelectorAll('.segment-btn');
  const pageFilteredCount = document.getElementById('pageFilteredCount');
  const totalFilteredCount = document.getElementById('totalFilteredCount');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const reloadTabBtn = document.getElementById('reloadTabBtn');

  let currentSettings = null;
  let activeTabId = null;

  async function init() {
    // 1. Получаем текущую вкладку
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      activeTabId = tab.id;
    }

    // 2. Загружаем настройки
    currentSettings = await StorageHelper.getSettings();
    renderSettings(currentSettings);

    // 3. Запрашиваем статистику текущей вкладки из Background
    if (activeTabId) {
      chrome.runtime.sendMessage(
        { action: Constants.MESSAGES.GET_PAGE_STATS, tabId: activeTabId },
        (response) => {
          if (response && typeof response.filteredCount === 'number') {
            pageFilteredCount.textContent = response.filteredCount;
          }
        }
      );
    }

    // 4. Навешиваем слушатели событий
    bindEvents();
  }

  function renderSettings(settings) {
    // Мастер-переключатель
    masterToggle.checked = Boolean(settings.enabled);
    updateStatusBadge(settings.enabled);

    // Подчинённые переключатели
    networkToggle.checked = Boolean(settings.networkProtection);
    domToggle.checked = Boolean(settings.domFiltering);

    // Доступность подчинённых элементов
    networkToggle.disabled = !settings.enabled;
    domToggle.disabled = !settings.enabled;

    // Режим скрытия
    renderFilterMode(settings.filterMode);
    modeSection.style.opacity = (settings.enabled && settings.domFiltering) ? '1' : '0.5';
    modeSection.style.pointerEvents = (settings.enabled && settings.domFiltering) ? 'auto' : 'none';

    // Общая статистика
    totalFilteredCount.textContent = (settings.stats && settings.stats.totalFilteredElements) || 0;
  }

  function updateStatusBadge(isEnabled) {
    if (isEnabled) {
      statusBadge.className = 'status-badge active';
      statusText.textContent = 'Включено';
    } else {
      statusBadge.className = 'status-badge inactive';
      statusText.textContent = 'Выключено';
    }
  }

  function renderFilterMode(activeMode) {
    segmentBtns.forEach(btn => {
      if (btn.getAttribute('data-mode') === activeMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function bindEvents() {
    // Изменение мастер-переключателя
    masterToggle.addEventListener('change', async () => {
      const isEnabled = masterToggle.checked;
      currentSettings.enabled = isEnabled;
      updateStatusBadge(isEnabled);
      networkToggle.disabled = !isEnabled;
      domToggle.disabled = !isEnabled;
      modeSection.style.opacity = (isEnabled && currentSettings.domFiltering) ? '1' : '0.5';
      modeSection.style.pointerEvents = (isEnabled && currentSettings.domFiltering) ? 'auto' : 'none';

      await StorageHelper.saveSettings({ enabled: isEnabled });
    });

    // Уровень 1 (Сетевой)
    networkToggle.addEventListener('change', async () => {
      const isNet = networkToggle.checked;
      currentSettings.networkProtection = isNet;
      await StorageHelper.saveSettings({ networkProtection: isNet });
    });

    // Уровень 2 (DOM)
    domToggle.addEventListener('change', async () => {
      const isDom = domToggle.checked;
      currentSettings.domFiltering = isDom;
      modeSection.style.opacity = (currentSettings.enabled && isDom) ? '1' : '0.5';
      modeSection.style.pointerEvents = (currentSettings.enabled && isDom) ? 'auto' : 'none';
      await StorageHelper.saveSettings({ domFiltering: isDom });
    });

    // Переключение режима скрытия (Blur / Hide / Replace)
    segmentBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = btn.getAttribute('data-mode');
        renderFilterMode(mode);
        currentSettings.filterMode = mode;
        await StorageHelper.saveSettings({ filterMode: mode });
      });
    });

    // Открыть страницу настроек
    openOptionsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options/options.html'));
      }
    });

    // Перезагрузить страницу
    reloadTabBtn.addEventListener('click', () => {
      if (activeTabId) {
        chrome.tabs.reload(activeTabId);
        window.close();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
