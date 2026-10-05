const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

// Priorizar GPU integrada de bajo consumo para evitar consumo de energía excesivo y calor
app.commandLine.appendSwitch('force_low_power_gpu');
app.commandLine.appendSwitch('disable-renderer-backgrounding', 'false');

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
      spellcheck: false,
      backgroundThrottling: true,
    },
  });

  // Ocultar barra de menú por defecto para diseño limpio de aplicación nativa
  Menu.setApplicationMenu(null);

  const distPath = path.join(__dirname, '../dist/index.html');

  // Cargar directamente los archivos locales empaquetados para funcionamiento 100% nativo y veloz
  win.loadFile(distPath).catch((err) => {
    console.error('Error al cargar la interfaz local:', err);
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Abrir enlaces externos (documentos en la nube, enlaces web, adjuntos) en el navegador predeterminado
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Prevenir navegación interna accidental a sitios web externos
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// Bloqueo de instancia única: si ya está abierta, traer al frente la ventana existente
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

  app.whenReady().then(async () => {
    // Limpiar cachés y service workers heredados para evitar pantallas en negro por colisión de versiones
    try {
      await session.defaultSession.clearStorageData({
        storages: ['serviceworkers', 'cachestorage'],
      });
    } catch {
      // Ignorar errores de limpieza de almacenamiento
    }

    createWindow();
  });

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
