const DEFAULT_SETTINGS = {
  theme: 'dark',
  accent: '#8b5cf6',
  background: '',
  transparency: 0.85
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  bookmarks: [],
  history: []
};

const elements = {};

const $ = (selector) => document.querySelector(selector);

const initElements = () => {
  elements.addressBar = $('#addressBar');
  elements.goBtn = $('#goBtn');
  elements.favoriteBtn = $('#favoriteBtn');
  elements.backBtn = $('#backBtn');
  elements.forwardBtn = $('#forwardBtn');
  elements.reloadBtn = $('#reloadBtn');
  elements.homeBtn = $('#homeBtn');
  elements.status = $('#statusIndicator');
  elements.sidebarButtons = document.querySelectorAll('.sidebar-btn');
  elements.homeView = $('#homeView');
  elements.browserView = document.getElementById('browserView');
  elements.bookmarksPanel = $('#bookmarksPanel');
  elements.historyPanel = $('#historyPanel');
  elements.settingsPanel = $('#settingsPanel');
  elements.bookmarksList = $('#bookmarksList');
  elements.historyList = $('#historyList');
  elements.clearBookmarks = $('#clearBookmarks');
  elements.clearHistory = $('#clearHistory');
  elements.accentColor = $('#accentColor');
  elements.transparency = $('#transparency');
  elements.backgroundPath = $('#backgroundPath');
  elements.settingsForm = $('#settingsForm');
  elements.resetSettings = $('#resetSettings');
  elements.quickButtons = document.querySelectorAll('.quick-btn[data-url]');
  elements.playerToggle = $('#playerToggle');
  elements.playerStatus = $('#playerStatus');
  elements.homeBackground = $('#homeBackground');
};

const audioEngine = (() => {
  let context;
  let gainNode;
  let oscillators = [];
  let playing = false;

  const ensureContext = async () => {
    if (!context) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('AudioContext non supporté');
      }
      context = new AudioContextCtor();
    }
    if (context.state === 'suspended') {
      await context.resume();
    }
  };

  const createVoice = (type, frequency, detune = 0) => {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    if (detune) {
      osc.detune.setValueAtTime(detune, context.currentTime);
    }
    osc.connect(gainNode);
    osc.start();
    return osc;
  };

  const start = async () => {
    if (playing) return true;
    await ensureContext();

    gainNode = context.createGain();
    gainNode.gain.setValueAtTime(0.0001, context.currentTime);
    gainNode.connect(context.destination);
    gainNode.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.3);

    oscillators = [
      createVoice('sawtooth', 96),
      createVoice('triangle', 192, 6),
      createVoice('square', 384, -12)
    ];

    playing = true;
    return true;
  };

  const stop = () => {
    if (!playing || !context) return false;
    const stopTime = context.currentTime + 0.25;
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    oscillators.forEach((osc) => {
      try {
        osc.stop(stopTime);
      } catch (error) {
        console.warn('Oscillator déjà arrêté', error);
      }
      osc.disconnect();
    });
    setTimeout(() => {
      if (gainNode) {
        try {
          gainNode.disconnect();
        } catch (error) {
          console.warn('Gain déjà déconnecté', error);
        }
      }
      oscillators = [];
      gainNode = null;
    }, 300);
    playing = false;
    return false;
  };

  const toggle = async () => {
    if (playing) {
      return stop();
    }
    try {
      return await start();
    } catch (error) {
      console.error('Lecture audio impossible', error);
      return false;
    }
  };

  const isPlaying = () => playing;

  return { toggle, isPlaying, stop };
})();

const normalizeUrl = (input) => {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('gx://home')) {
    return 'gx://home';
  }
  if (/^([a-zA-Z][a-zA-Z\d+.-]*):/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }
  const encoded = encodeURIComponent(trimmed);
  return `https://duckduckgo.com/?q=${encoded}`;
};

const setStatus = (text) => {
  if (elements.status) {
    elements.status.textContent = text;
  }
};

const showHome = () => {
  hidePanels();
  elements.homeView.classList.add('visible');
  elements.browserView.classList.remove('visible');
  elements.addressBar.value = '';
  setStatus('Accueil');
  updateFavoriteIcon('gx://home');
  elements.backBtn.disabled = true;
  elements.forwardBtn.disabled = true;
  audioEngine.stop();
  updatePlayerUi(false);
};

const navigate = (rawUrl) => {
  const url = normalizeUrl(rawUrl || elements.addressBar.value);
  if (!url) {
    showHome();
    return;
  }
  if (url === 'gx://home') {
    showHome();
    return;
  }
  hidePanels();
  elements.homeView.classList.remove('visible');
  elements.browserView.classList.add('visible');
  audioEngine.stop();
  updatePlayerUi(false);
  elements.browserView.loadURL(url);
  elements.addressBar.value = url;
  setStatus('Chargement…');
};

const updateNavButtons = () => {
  elements.backBtn.disabled = !elements.browserView.canGoBack();
  elements.forwardBtn.disabled = !elements.browserView.canGoForward();
};

const updateFavoriteIcon = (currentUrl) => {
  const exists = state.bookmarks.some((item) => item.url === currentUrl);
  if (exists) {
    elements.favoriteBtn.classList.add('active');
  } else {
    elements.favoriteBtn.classList.remove('active');
  }
};

const hidePanels = () => {
  elements.bookmarksPanel.classList.remove('visible');
  elements.historyPanel.classList.remove('visible');
  elements.settingsPanel.classList.remove('visible');
  elements.sidebarButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === 'home');
  });
};

const renderBookmarks = () => {
  elements.bookmarksList.innerHTML = '';
  if (!state.bookmarks.length) {
    const empty = document.createElement('li');
    empty.textContent = 'Aucun favori.';
    elements.bookmarksList.appendChild(empty);
    return;
  }
  state.bookmarks.forEach((bookmark, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'panel-link';
    button.textContent = bookmark.title || bookmark.url;
    button.addEventListener('click', () => navigate(bookmark.url));

    const remove = document.createElement('span');
    remove.className = 'panel-remove';
    remove.textContent = '×';
    remove.title = 'Supprimer';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      state.bookmarks.splice(index, 1);
      state.bookmarks = window.gxData.saveBookmarks(state.bookmarks);
      renderBookmarks();
      updateFavoriteIcon(elements.addressBar.value.trim());
    });

    item.appendChild(button);
    item.appendChild(remove);
    elements.bookmarksList.appendChild(item);
  });
};

const renderHistory = () => {
  elements.historyList.innerHTML = '';
  if (!state.history.length) {
    const empty = document.createElement('li');
    empty.textContent = 'Historique vide.';
    elements.historyList.appendChild(empty);
    return;
  }
  state.history.forEach((entry) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'panel-link';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'entry-title';
    titleSpan.textContent = entry.title || entry.url;
    const urlSpan = document.createElement('span');
    urlSpan.className = 'entry-url';
    urlSpan.textContent = entry.url;
    button.appendChild(titleSpan);
    button.appendChild(urlSpan);
    button.addEventListener('click', () => navigate(entry.url));
    item.appendChild(button);
    elements.historyList.appendChild(item);
  });
};

const applyTheme = () => {
  const root = document.documentElement.style;
  root.setProperty('--accent', state.settings.accent);
  root.setProperty('--glass', state.settings.transparency);
  updateHomeBackground();
};

const updateHomeBackground = () => {
  const background = (state.settings.background || '').trim();
  const isVideo = background.match(/\.(mp4|webm|mov)$/i);
  elements.homeBackground.innerHTML = '';
  elements.homeBackground.style.backgroundImage = '';
  if (!background) {
    elements.homeBackground.style.backgroundImage =
      "radial-gradient(circle at top left, rgba(139, 92, 246, 0.35), transparent)," +
      "radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.35), transparent)";
    return;
  }
  if (isVideo) {
    const video = document.createElement('video');
    video.src = background;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    elements.homeBackground.appendChild(video);
  } else {
    elements.homeBackground.style.backgroundImage = `url('${background}')`;
  }
};

const loadData = () => {
  state.settings = { ...DEFAULT_SETTINGS, ...window.gxData.loadSettings() };
  state.bookmarks = window.gxData.loadBookmarks();
  state.history = window.gxData.loadHistory();
  applyTheme();
  renderBookmarks();
  renderHistory();
  elements.accentColor.value = state.settings.accent;
  elements.transparency.value = state.settings.transparency;
  elements.backgroundPath.value = state.settings.background;
};

const saveSettings = (settings) => {
  state.settings = window.gxData.saveSettings(settings);
  applyTheme();
};

const addToHistory = (title, url) => {
  if (!url || url.startsWith('gx://')) return;
  const entry = { title, url, timestamp: Date.now() };
  state.history = window.gxData.appendHistory(entry);
  renderHistory();
};

const toggleFavorite = () => {
  let currentUrl = elements.addressBar.value.trim();
  if (!currentUrl && elements.homeView.classList.contains('visible')) {
    currentUrl = 'gx://home';
  }
  if (!currentUrl) return;
  const existingIndex = state.bookmarks.findIndex((item) => item.url === currentUrl);
  if (existingIndex >= 0) {
    state.bookmarks.splice(existingIndex, 1);
  } else {
    const title = elements.browserView.getTitle() || currentUrl;
    state.bookmarks.unshift({ title, url: currentUrl });
  }
  state.bookmarks = window.gxData.saveBookmarks(state.bookmarks);
  updateFavoriteIcon(currentUrl);
  renderBookmarks();
};

const showPanel = (panel) => {
  elements.homeView.classList.toggle('visible', panel === 'home' && !elements.browserView.classList.contains('visible'));
  elements.bookmarksPanel.classList.toggle('visible', panel === 'bookmarks');
  elements.historyPanel.classList.toggle('visible', panel === 'history');
  elements.settingsPanel.classList.toggle('visible', panel === 'settings');
  elements.sidebarButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === panel);
  });
};

const setupEventListeners = () => {
  elements.goBtn.addEventListener('click', () => navigate());
  elements.addressBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      navigate();
    }
  });
  elements.favoriteBtn.addEventListener('click', toggleFavorite);
  elements.backBtn.addEventListener('click', () => elements.browserView.goBack());
  elements.forwardBtn.addEventListener('click', () => elements.browserView.goForward());
  elements.reloadBtn.addEventListener('click', () => elements.browserView.reload());
  elements.homeBtn.addEventListener('click', () => {
    elements.browserView.classList.remove('visible');
    showHome();
  });

  elements.clearBookmarks.addEventListener('click', () => {
    state.bookmarks = window.gxData.saveBookmarks([]);
    renderBookmarks();
    updateFavoriteIcon(elements.homeView.classList.contains('visible') ? 'gx://home' : elements.addressBar.value.trim());
  });
  elements.clearHistory.addEventListener('click', () => {
    state.history = window.gxData.clearHistory();
    renderHistory();
  });

  elements.quickButtons.forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.url));
  });

  elements.sidebarButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.target;
      showPanel(target);
      if (target === 'home') {
        showHome();
      }
    });
  });

  elements.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const updated = {
      ...state.settings,
      accent: elements.accentColor.value,
      transparency: parseFloat(elements.transparency.value),
      background: elements.backgroundPath.value.trim()
    };
    saveSettings(updated);
  });

  elements.resetSettings.addEventListener('click', () => {
    elements.accentColor.value = DEFAULT_SETTINGS.accent;
    elements.transparency.value = DEFAULT_SETTINGS.transparency;
    elements.backgroundPath.value = DEFAULT_SETTINGS.background;
    saveSettings({ ...DEFAULT_SETTINGS });
  });

  elements.playerToggle.addEventListener('click', async () => {
    const playing = await audioEngine.toggle();
    updatePlayerUi(playing);
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      elements.browserView.reload();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      elements.addressBar.focus();
      elements.addressBar.select();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      showHome();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 't') {
      event.preventDefault();
      showHome();
    }
    if (event.key === 'F11') {
      event.preventDefault();
      window.gxData.send('toggle-fullscreen');
    }
  });

  elements.browserView.addEventListener('did-start-loading', () => {
    setStatus('Chargement…');
  });

  elements.browserView.addEventListener('did-stop-loading', () => {
    setStatus('Terminé');
    updateNavButtons();
    const url = elements.browserView.getURL();
    if (url) {
      elements.addressBar.value = url;
      updateFavoriteIcon(url);
      addToHistory(elements.browserView.getTitle(), url);
    }
  });

  elements.browserView.addEventListener('did-fail-load', () => {
    setStatus('Échec du chargement');
  });

  elements.browserView.addEventListener('did-navigate-in-page', (event) => {
    const { url } = event;
    if (url) {
      elements.addressBar.value = url;
      updateFavoriteIcon(url);
      addToHistory(elements.browserView.getTitle(), url);
    }
    updateNavButtons();
  });
};

function updatePlayerUi(playing) {
  if (!elements.playerToggle || !elements.playerStatus) return;
  if (playing) {
    elements.playerStatus.textContent = '▶️';
    elements.playerToggle.textContent = 'Pause';
  } else {
    elements.playerStatus.textContent = '⏸︎';
    elements.playerToggle.textContent = 'Lecture';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initElements();
  loadData();
  setupEventListeners();
  showHome();
});
