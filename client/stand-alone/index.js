const path = require('path'),
      { app, BrowserWindow } = require('electron');

function createApplication(onCreate, onClose) {
  function createWindow() {
    // Create the browser window.
    appWindow = new BrowserWindow({
      width: 800, height: 600
    });

    // Disable the app menu
    appWindow.setMenu(null);

    // and load the index.html of the app.
    var indexPath = path.join(__dirname, 'index.html');
    appWindow.loadURL(`file://${indexPath}`);

    // Open the DevTools.
    // appWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    appWindow.on('closed', () => {
      if (typeof onClose === 'function')
        onClose(appWindow);

      appWindow = null;
    });

    if (typeof onCreate === 'function')
      onCreate(appWindow);
  }

  var appWindow;

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow);

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin')
      app.quit();
  });

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (appWindow === null)
      createWindow();
  });
}

createApplication(
  (appWindow) => {
    global.appWindow = appWindow;
  },
  (appWindow) => {
    global.appWindow = null;
  }
);
