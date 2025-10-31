const { app, BrowserWindow, ipcMain } = require("electron");
const { PosPrinter } = require("electron-pos-printer");
const path = require("path");
const fs = require("fs");

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

// Handle get printers request
ipcMain.handle("get-printers", async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    console.log("Available printers:", printers);
    return { success: true, printers };
  } catch (error) {
    console.error("Get printers error:", error);
    return { success: false, error: error.message };
  }
});

// Handle print bill request
// ipcMain.handle("print-bill", async (event, html, options = {}) => {
//   try {
//     const { silent = true, printerName = "" } = options;

//     // Create a hidden window for printing
//     const printWindow = new BrowserWindow({
//       // show: false, // Keep window hidden
//       width: 800,
//       height: 600,
//       webPreferences: {
//         nodeIntegration: false,
//         contextIsolation: true,
//       },
//     });

//     // Load HTML content into the hidden window
//     // Use base64 encoding to preserve HTML formatting for thermal printers
//     const base64Html = Buffer.from(html, "utf8").toString("base64");
//     console.log("HTML content length:", html.length);
//     console.log("HTML preview:", html.substring(0, 200));
//     await printWindow.loadURL(
//       `data:text/html;charset=utf-8;base64,${base64Html}`
//     );

//     // Wait for content to load (max 1 second)
//     await new Promise((resolve) => {
//       let resolved = false;

//       const onFinishLoad = () => {
//         if (!resolved) {
//           resolved = true;
//           resolve();
//         }
//       };

//       const onDomReady = () => {
//         if (!resolved) {
//           resolved = true;
//           resolve();
//         }
//       };

//       printWindow.webContents.once("did-finish-load", onFinishLoad);
//       printWindow.webContents.once("dom-ready", onDomReady);

//       setTimeout(() => {
//         if (!resolved) {
//           resolved = true;
//           resolve();
//         }
//       }, 1000);
//     });

//     // Minimal delay for content to be ready
//     await new Promise((resolve) => setTimeout(resolve, 100));

//     // Verify content is loaded correctly
//     try {
//       const loadedContent = await printWindow.webContents.executeJavaScript(
//         "document.body.innerText.substring(0, 100)"
//       );
//       console.log("Loaded content preview:", loadedContent);
//       const hasContent = await printWindow.webContents.executeJavaScript(
//         "document.body.innerText.length > 0"
//       );
//       console.log("Has content:", hasContent);
//     } catch (jsError) {
//       console.log("Could not verify content:", jsError.message);
//     }

//     // Print options - optimized for thermal printers
//     // When silent=true and deviceName is empty, Electron automatically picks the default printer
//     const printOptions = {
//       silent: silent,
//       printBackground: false, // Disable background for thermal printers
//       deviceName: printerName || "", // Use provided printer name or let Electron choose default
//       pageSize: "A4",
//       margins: {
//         marginType: "none", // No margins for thermal receipts
//       },
//       landscape: false,
//       scaleFactor: 1.0,
//       color: false, // Black and white for thermal printers
//       copies: 1,
//     };

//     // Print using hidden window
//     try {
//       console.log("Starting print job with options:", printOptions);
//       // Start the print job
//       printWindow.webContents.print(printOptions);

//       // Give the print job time to be queued (1 second should be enough)
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       console.log("Print job should be queued now");
//     } catch (printError) {
//       console.error("Print error:", printError);
//       // Close the hidden window on error
//       printWindow.close();
//       return { success: false, error: printError.message };
//     }

//     // Close the hidden window after successful print
//     printWindow.close();

//     return {
//       success: true,
//       data: "Print job sent",
//       printerUsed: printerName || "default",
//     };
//   } catch (error) {
//     console.error("Print error:", error);
//     return { success: false, error: error.message };
//   }
// });

ipcMain.handle("print-bill", async (event, html, options = {}) => {
  try {
    const { silent = true, printerName = "RP327 Printer" } = options;

    const opt = {
      preview: false, // Preview in window or print
      margin: "0 0 0 0", // margin of content body
      copies: 1, // Number of copies to print
      printerName: printerName, // printerName: string, check it at webContent.getPrinters()
      timeOutPerLine: 4000,
      silent: true,
      pageSize: "80mm",
    };

    const data = [
      {
        type: "text",
        value: "HEADER",
        style: { fontSize: "18px" },
      },
    ];

    PosPrinter.print(data, opt)
      .then(() => {
        return {
          success: true,
          data: "Print job sent",
          printerUsed: printerName || "default",
        };
      })
      .catch((error) => {
        console.error("Print error:", error);
        return { success: false, error: error.message };
      });
  } catch (error) {
    console.error("Print error:", error);
    return { success: false, error: error.message };
  }
});
