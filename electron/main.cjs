const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const LIVE_URL = 'https://timebox-hub.vercel.app/';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'TimeBox Hub',
    backgroundColor: '#06080c',
    icon: path.join(__dirname, '../public/icons/windows/Square44x44Logo.targetsize-256.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Remove default menu bar for clean app aesthetic
  Menu.setApplicationMenu(null);

  const distPath = path.join(__dirname, '../dist/index.html');

  // Intenta cargar la versión viva en Vercel para sincronización automática instantánea con GitHub
  win.loadURL(LIVE_URL).catch(() => {
    // Fallback a archivos locales empaquetados si no hay internet al iniciar
    win.loadFile(distPath).catch(() => {});
  });

  // Si se cae la conexión durante la carga inicial, cambia a la copia local sin romperse
  win.webContents.on('did-fail-load', (event, errorCode) => {
    // -3 es ABORTED (por ejemplo, cancelado por el usuario), no hacer fallback en ese caso
    if (errorCode !== -3) {
      win.loadFile(distPath).catch(() => {});
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Open external links in default browser instead of electron window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      if (!url.startsWith(LIVE_URL)) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });
}

// Single instance lock: if another instance is opened, focus the existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      if (wins[0].isMinimized()) wins[0].restore();
      wins[0].focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
