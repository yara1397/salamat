const { app, BrowserWindow, Menu, Tray, shell, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow = null;
let tray = null;
let serverProcess = null;
const SERVER_PORT = 1000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// ── Start embedded Express server ────────────────────────────────────────────
function startServer() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: SERVER_PORT },
    silent: true
  });
  serverProcess.stdout?.on('data', d => console.log('[Server]', d.toString().trim()));
  serverProcess.stderr?.on('data', d => console.error('[Server ERR]', d.toString().trim()));
  serverProcess.on('exit', code => console.log('[Server] exited with code', code));
}

// ── Create main window ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 780,
    minWidth: 360,
    minHeight: 600,
    title: 'نت‌یار',
    backgroundColor: '#0a0e1a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png')
  });

  // Remove default menu
  Menu.setApplicationMenu(null);

  // Wait for server then load
  let tries = 0;
  const tryLoad = () => {
    const http = require('http');
    http.get(SERVER_URL, () => {
      mainWindow.loadURL(SERVER_URL);
    }).on('error', () => {
      tries++;
      if (tries < 20) setTimeout(tryLoad, 500);
      else mainWindow.loadURL(SERVER_URL); // try anyway
    });
  };
  setTimeout(tryLoad, 800);

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', e => {
    if (process.platform === 'darwin') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Tray icon ────────────────────────────────────────────────────────────────
function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'public', 'icon-16.png');
    tray = new Tray(iconPath);
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }
  tray.setToolTip('نت‌یار');
  const menu = Menu.buildFromTemplate([
    { label: 'باز کردن نت‌یار', click: () => { mainWindow?.show() || createWindow(); } },
    { type: 'separator' },
    { label: 'خروج', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => mainWindow ? mainWindow.show() : createWindow());
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startServer();
  createWindow();
  if (process.platform !== 'linux') createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
});

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
