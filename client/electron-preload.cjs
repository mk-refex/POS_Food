const { contextBridge } = require("electron");

console.log("Preload script loaded");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
// Print functionality now uses simple window.print() with kiosk-printing flag
contextBridge.exposeInMainWorld("electron", {
  // Electron API is kept minimal for backward compatibility
  // Printing is now handled by window.print() with --kiosk-printing flag
});

console.log("Electron API exposed to window.electron");
