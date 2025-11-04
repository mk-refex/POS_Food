const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

// Enable kiosk printing mode (Chrome will print automatically without dialog)
app.commandLine.appendSwitch("kiosk-printing");

let mainWindow;

function createWindow() {
  console.log("Creating main window...");
  console.log("Current directory:", __dirname);
  console.log(
    "Preload script exists:",
    require("fs").existsSync(path.join(__dirname, "electron-preload.cjs"))
  );

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, "electron-preload.cjs"),
    },
  });

  console.log(
    "Preload script path:",
    path.resolve(__dirname, "electron-preload.cjs")
  );

  // Load the app
  if (true) {
    console.log("Loading development URL...");

    // Wait a bit for Vite server to be ready
    setTimeout(() => {
      mainWindow.loadURL("http://localhost:3000").catch((err) => {
        console.error("Failed to load URL:", err);
        // Try loading a simple HTML page instead
        mainWindow.loadURL(
          "data:text/html,<h1>Vite server not ready. Please start with: npm run dev</h1>"
        );
      });
    }, 2000);
  } else {
    console.log("Loading production file...");
    mainWindow.loadFile("build /index.html");
  }

  // Add event listeners for debugging
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Page finished loading");
  });

  mainWindow.webContents.on("preload-error", (event, preloadPath, error) => {
    console.error("Preload script error:", preloadPath, error);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        "Failed to load:",
        errorCode,
        errorDescription,
        validatedURL
      );
    }
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
