export function buildReceiptHtml(billing: any) {
  const customerName = billing.isGuest
    ? billing.customer?.name
    : billing.isSupportStaff
      ? billing.customer?.name
      : billing.customer?.employeeName;

  const currentUser = localStorage.getItem("currentUser") || "admin";
  let currentUserName = "Admin";
  try {
    const userData = JSON.parse(currentUser);
    currentUserName = userData?.name || userData?.username || "Admin";
  } catch (e) {
    currentUserName = "Admin";
  }

  const billNumber = billing.id;

  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Kitchen Print - Bill ${billNumber}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0mm !important;
      }
      * {
        box-sizing: border-box;
      }
      body {
        font-family: monospace;
        width: 76mm; /* add small left/right margins within 80mm roll */
        margin: 0;
        padding: 0 2mm; /* 2mm left and right padding for small margins */
        font-size: 13px;
        line-height: 1.3;
        color: #000;
        background: #fff;
      }
      .center {
        font-size: 16px;
        text-align: center;
        font-weight: bold;
      }
      .section {
        margin: 4px 0;
      }
      .line {
        border-top: 1px dashed #000;
        margin: 4px 0;
      }
      .item-row {
        display: flex;
        justify-content: space-between;
        white-space: pre;
      }
    </style>
  </head>
  <body>
    <div class="center">KITCHEN PRINT</div>
    <div class="center">Refex Group</div>
    <div class="center">*** Bill No: ${billNumber} ***</div>
  
    <div class="section">
      <b>Customer:</b> ${customerName || ""}
      <br/><b>Created By:</b> ${currentUserName}
      <div class="item-row">
        <span><b>Date:</b> ${billing.date.split("-").reverse().join("/")}</span>
        <span><b>Time:</b> ${billing.time}</span>
      </div>
    </div>
  
    <div class="line"></div>
    <div class="item-row">
      <span><b>Item</b></span>
      <span><b>Qty</b></span>
    </div>
    <div class="line"></div>
  
    ${billing.items
      .map((it: any) => {
        const flag = it.isException ? " (EXC)" : "";
        return `<div class="item-row"><span>${it.name}${flag}</span><span>${it.quantity}</span></div>`;
      })
      .join("")}
  
    <div class="line"></div>
  </body>
  </html>`;
}

