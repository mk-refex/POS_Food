chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'printContent') {
    const printWindow = window.open('', '_blank', 'width=1,height=1,left=-1000,top=-1000');
    if (printWindow) {
      printWindow.document.write(request.content);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
          }, 1000);
        }, 500);
      };
    }
  }
});
