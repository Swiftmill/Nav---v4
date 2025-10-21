const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

const files = {
  settings: {
    file: path.join(dataDir, 'settings.json'),
    default: {
      theme: 'dark',
      accent: '#8b5cf6',
      background: '',
      transparency: 0.85
    }
  },
  bookmarks: {
    file: path.join(dataDir, 'bookmarks.json'),
    default: [
      { title: 'GX Browser Home', url: 'gx://home' },
      { title: 'DuckDuckGo', url: 'https://duckduckgo.com' }
    ]
  },
  history: {
    file: path.join(dataDir, 'history.json'),
    default: []
  }
};

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const writeDefaultIfNeeded = (key) => {
  ensureDataDir();
  const info = files[key];
  try {
    if (!fs.existsSync(info.file)) {
      fs.writeFileSync(info.file, JSON.stringify(info.default, null, 2), 'utf8');
    } else {
      JSON.parse(fs.readFileSync(info.file, 'utf8'));
    }
  } catch (error) {
    fs.writeFileSync(info.file, JSON.stringify(info.default, null, 2), 'utf8');
  }
};

const readData = (key) => {
  writeDefaultIfNeeded(key);
  const info = files[key];
  const raw = fs.readFileSync(info.file, 'utf8');
  return JSON.parse(raw);
};

const writeData = (key, value) => {
  ensureDataDir();
  const info = files[key];
  fs.writeFileSync(info.file, JSON.stringify(value, null, 2), 'utf8');
  return readData(key);
};

contextBridge.exposeInMainWorld('gxData', {
  loadSettings: () => readData('settings'),
  saveSettings: (settings) => writeData('settings', settings),
  loadBookmarks: () => readData('bookmarks'),
  saveBookmarks: (bookmarks) => writeData('bookmarks', bookmarks),
  loadHistory: () => readData('history'),
  saveHistory: (history) => writeData('history', history),
  appendHistory: (entry) => {
    const history = readData('history');
    history.unshift(entry);
    const trimmed = history.slice(0, 200);
    return writeData('history', trimmed);
  },
  clearHistory: () => writeData('history', []),
  on: (channel, callback) => {
    const valid = ['trigger-fullscreen'];
    if (valid.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => callback(data));
    }
  },
  send: (channel, data) => {
    const valid = ['toggle-fullscreen'];
    if (valid.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  }
});
