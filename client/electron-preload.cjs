const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  getPrinters: () => {
    console.log('getPrinters called from renderer');
    return ipcRenderer.invoke('get-printers');
  },
  printBill: (html, options) => {
    console.log('printBill called from renderer');
    return ipcRenderer.invoke('print-bill', html, options);
  }
});

console.log('Electron API exposed to window.electron');
