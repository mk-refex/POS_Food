/// <reference types="vite/client" />

interface ElectronAPI {
  printBill: (html: string, options?: { silent?: boolean; printerName?: string }) => Promise<void>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
