/**
 * SearchGuard - Options Dashboard Controller
 */
(function () {
  'use strict';

  const { StorageHelper, DefaultRules } = window.SearchGuard;

  let settings = null;
  const toast = document.getElementById('toast');

  async function init() {
    settings = await StorageHelper.getSettings();

    setupTabs();
    renderGeneral();
    renderEngines();
    renderKeywords();
    renderDomains();
    renderWhitelist();
    setupBackup();
  }

  function showToast(message = 'Настройки сохранены') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  /* 1. Tab Navigation */
  function setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetTab = item.getAttribute('data-tab');

        navItems.forEach(i => i.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        item.classList.add('active');
        const activePane = document.getElementById(`tab-${targetTab}`);
        if (activePane) activePane.classList.add('active');
      });
    });
  }

  /* 2. General Settings */
  function renderGeneral() {
    const optEnabled = document.getElementById('opt-enabled');
    const optNetwork = document.getElementById('opt-network');
    const optBlockDomains = document.getElementById('opt-block-domains');
    const optDom = document.getElementById('opt-dom');
    const optMode = document.getElementById('opt-mode');
    const optUnblur = document.getElementById('opt-unblur');

    optEnabled.checked = Boolean(settings.enabled);
    optNetwork.checked = Boolean(settings.networkProtection);
    optBlockDomains.checked = Boolean(settings.blockAdultDomainsDirectly);
    optDom.checked = Boolean(settings.domFiltering);
    optMode.value = settings.filterMode || 'blur';
    optUnblur.checked = Boolean(settings.showUnblurButton);

    optEnabled.addEventListener('change', async () => {
      settings.enabled = optEnabled.checked;
      await StorageHelper.saveSettings({ enabled: settings.enabled });
      showToast();
    });

    optNetwork.addEventListener('change', async () => {
      settings.networkProtection = optNetwork.checked;
      await StorageHelper.saveSettings({ networkProtection: settings.networkProtection });
      showToast();
    });

    optBlockDomains.addEventListener('change', async () => {
      settings.blockAdultDomainsDirectly = optBlockDomains.checked;
      await StorageHelper.saveSettings({ blockAdultDomainsDirectly: settings.blockAdultDomainsDirectly });
      showToast();
    });

    optDom.addEventListener('change', async () => {
      settings.domFiltering = optDom.checked;
      await StorageHelper.saveSettings({ domFiltering: settings.domFiltering });
      showToast();
    });

    optMode.addEventListener('change', async () => {
      settings.filterMode = optMode.value;
      await StorageHelper.saveSettings({ filterMode: settings.filterMode });
      showToast();
    });

    optUnblur.addEventListener('change', async () => {
      settings.showUnblurButton = optUnblur.checked;
      await StorageHelper.saveSettings({ showUnblurButton: settings.showUnblurButton });
      showToast();
    });

    const optThreshold = document.getElementById('opt-threshold');
    if (optThreshold) {
      optThreshold.value = typeof settings.threshold === 'number' ? settings.threshold : 6;

      optThreshold.addEventListener('change', async () => {
        let rawVal = parseInt(optThreshold.value, 10);
        if (isNaN(rawVal)) {
          rawVal = 6;
        }
        // Clamping within min=1, max=100
        const clamped = Math.min(100, Math.max(1, rawVal));
        optThreshold.value = clamped;
        settings.threshold = clamped;
        await StorageHelper.saveSettings({ threshold: clamped });
        showToast(`Порог чувствительности сохранён: ${clamped}`);
      });
    }
  }

  /* 3. Search Engines */
  function renderEngines() {
    const engines = ['yandex', 'google', 'bing', 'duckduckgo'];

    engines.forEach(engine => {
      const toggle = document.getElementById(`engine-${engine}`);
      if (!toggle) return;

      toggle.checked = settings.enabledEngines[engine] !== false;

      toggle.addEventListener('change', async () => {
        settings.enabledEngines[engine] = toggle.checked;
        await StorageHelper.saveSettings({ enabledEngines: settings.enabledEngines });
        showToast();
      });
    });
  }

  /* 4. Custom Keywords */
  function renderKeywords() {
    const container = document.getElementById('keywordTags');
    const input = document.getElementById('newKeywordInput');
    const addBtn = document.getElementById('addKeywordBtn');

    function redraw() {
      container.innerHTML = '';
      const list = settings.customKeywords || [];

      if (list.length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">Нет добавленных ключевых слов</span>';
        return;
      }

      list.forEach((kw, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
          <span>${escapeHtml(kw)}</span>
          <span class="tag-remove" data-index="${index}">&times;</span>
        `;
        tag.querySelector('.tag-remove').addEventListener('click', async () => {
          settings.customKeywords.splice(index, 1);
          await StorageHelper.saveSettings({ customKeywords: settings.customKeywords });
          redraw();
          showToast('Ключевое слово удалено');
        });
        container.appendChild(tag);
      });
    }

    const addKeyword = async () => {
      const val = input.value.trim().toLowerCase();
      if (!val) return;
      settings.customKeywords = settings.customKeywords || [];
      if (!settings.customKeywords.includes(val)) {
        settings.customKeywords.push(val);
        await StorageHelper.saveSettings({ customKeywords: settings.customKeywords });
        input.value = '';
        redraw();
        showToast('Ключевое слово добавлено');
      }
    };

    addBtn.addEventListener('click', addKeyword);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addKeyword();
    });

    redraw();
  }

  /* 5. Blocked Domains */
  function renderDomains() {
    const container = document.getElementById('domainTags');
    const input = document.getElementById('newDomainInput');
    const addBtn = document.getElementById('addDomainBtn');

    function redraw() {
      container.innerHTML = '';
      const list = settings.customBlockedDomains || [];

      if (list.length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">Нет добавленных доменов</span>';
        return;
      }

      list.forEach((dom, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
          <span>${escapeHtml(dom)}</span>
          <span class="tag-remove" data-index="${index}">&times;</span>
        `;
        tag.querySelector('.tag-remove').addEventListener('click', async () => {
          settings.customBlockedDomains.splice(index, 1);
          await StorageHelper.saveSettings({ customBlockedDomains: settings.customBlockedDomains });
          redraw();
          showToast('Домен удален');
        });
        container.appendChild(tag);
      });
    }

    const addDomain = async () => {
      let val = input.value.trim().toLowerCase();
      val = val.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      if (!val) return;
      settings.customBlockedDomains = settings.customBlockedDomains || [];
      if (!settings.customBlockedDomains.includes(val)) {
        settings.customBlockedDomains.push(val);
        await StorageHelper.saveSettings({ customBlockedDomains: settings.customBlockedDomains });
        input.value = '';
        redraw();
        showToast('Домен добавлен');
      }
    };

    addBtn.addEventListener('click', addDomain);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addDomain();
    });

    redraw();
  }

  /* 6. Whitelist (Домены и Фразы) */
  function renderWhitelist() {
    // 6.1 Домены
    const domainContainer = document.getElementById('whitelistTags');
    const domainInput = document.getElementById('newWhitelistInput');
    const domainAddBtn = document.getElementById('addWhitelistBtn');

    function redrawDomains() {
      domainContainer.innerHTML = '';
      const list = settings.whitelistedDomains || [];

      if (list.length === 0) {
        domainContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">Белый список сайтов пуст</span>';
        return;
      }

      list.forEach((dom, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
          <span>${escapeHtml(dom)}</span>
          <span class="tag-remove" data-index="${index}">&times;</span>
        `;
        tag.querySelector('.tag-remove').addEventListener('click', async () => {
          settings.whitelistedDomains.splice(index, 1);
          await StorageHelper.saveSettings({ whitelistedDomains: settings.whitelistedDomains });
          redrawDomains();
          showToast('Сайт удален из белого списка');
        });
        domainContainer.appendChild(tag);
      });
    }

    const addWhitelistDomain = async () => {
      let val = domainInput.value.trim().toLowerCase();
      val = val.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      if (!val) return;
      settings.whitelistedDomains = settings.whitelistedDomains || [];
      if (!settings.whitelistedDomains.includes(val)) {
        settings.whitelistedDomains.push(val);
        await StorageHelper.saveSettings({ whitelistedDomains: settings.whitelistedDomains });
        domainInput.value = '';
        redrawDomains();
        showToast('Сайт добавлен в белый список');
      }
    };

    domainAddBtn.addEventListener('click', addWhitelistDomain);
    domainInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addWhitelistDomain();
    });

    // 6.2 Фразы и запросы
    const phraseContainer = document.getElementById('whitelistPhraseTags');
    const phraseInput = document.getElementById('newWhitelistPhraseInput');
    const phraseAddBtn = document.getElementById('addWhitelistPhraseBtn');

    function redrawPhrases() {
      if (!phraseContainer) return;
      phraseContainer.innerHTML = '';
      const list = settings.whitelistedPhrases || [];

      if (list.length === 0) {
        phraseContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">Список разрешённых фраз пуст</span>';
        return;
      }

      list.forEach((phrase, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
          <span>${escapeHtml(phrase)}</span>
          <span class="tag-remove" data-index="${index}">&times;</span>
        `;
        tag.querySelector('.tag-remove').addEventListener('click', async () => {
          settings.whitelistedPhrases.splice(index, 1);
          await StorageHelper.saveSettings({ whitelistedPhrases: settings.whitelistedPhrases });
          redrawPhrases();
          showToast('Фраза удалена из белого списка');
        });
        phraseContainer.appendChild(tag);
      });
    }

    const addWhitelistPhrase = async () => {
      if (!phraseInput) return;
      let val = phraseInput.value.trim().toLowerCase();
      if (!val) return;
      settings.whitelistedPhrases = settings.whitelistedPhrases || [];
      if (!settings.whitelistedPhrases.includes(val)) {
        settings.whitelistedPhrases.push(val);
        await StorageHelper.saveSettings({ whitelistedPhrases: settings.whitelistedPhrases });
        phraseInput.value = '';
        redrawPhrases();
        showToast('Фраза добавлена в белый список');
      }
    };

    if (phraseAddBtn && phraseInput) {
      phraseAddBtn.addEventListener('click', addWhitelistPhrase);
      phraseInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addWhitelistPhrase();
      });
    }

    redrawDomains();
    redrawPhrases();
  }

  /* 7. Backup / Reset */
  function setupBackup() {
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const resetBtn = document.getElementById('resetBtn');

    // Экспорт
    exportBtn.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `searchguard-config-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Конфигурация экспортирована');
    });

    // Импорт
    importBtn.addEventListener('click', () => {
      importFile.click();
    });

    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          settings = await StorageHelper.saveSettings(imported);
          renderGeneral();
          renderEngines();
          renderKeywords();
          renderDomains();
          renderWhitelist();
          showToast('Настройки успешно импортированы');
        } catch (err) {
          alert('Ошибка чтения JSON файла конфигурации: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Сброс
    resetBtn.addEventListener('click', async () => {
      if (confirm('Вы уверены, что хотите сбросить все параметры к заводским значениям по умолчанию?')) {
        const defaults = JSON.parse(JSON.stringify(DefaultRules.DEFAULT_SETTINGS));
        settings = await StorageHelper.saveSettings(defaults);
        renderGeneral();
        renderEngines();
        renderKeywords();
        renderDomains();
        renderWhitelist();
        showToast('Все настройки сброшены к значениям по умолчанию');
      }
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
