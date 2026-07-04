const DEFAULT_USB_PRINTER_NAME = "KP-IM607 / POS58";

let printerConnected = false;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildReceiptHtml(text: string) {
  const content = escapeHtml(text);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Impressao ${DEFAULT_USB_PRINTER_NAME}</title>
    <style>
      @page {
        size: 58mm auto;
        margin: 3mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #000;
        background: #fff;
        font-family: "Courier New", monospace;
        font-size: 10px;
        line-height: 1.3;
      }

      .receipt {
        width: 52mm;
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <pre class="receipt">${content}

</pre>
  </body>
</html>`;
}

export function isUsbPrinterAvailable() {
  return typeof window !== "undefined" && typeof window.print === "function";
}

export function isUsbPrinterConnected() {
  return printerConnected;
}

export async function connectUsbPrinter() {
  if (!isUsbPrinterAvailable()) {
    throw new Error("Impressao pelo navegador nao esta disponivel neste ambiente.");
  }

  printerConnected = true;
  return { name: DEFAULT_USB_PRINTER_NAME };
}

export async function disconnectUsbPrinter() {
  printerConnected = false;
}

export async function printUsbText(text: string) {
  if (!isUsbPrinterAvailable()) {
    throw new Error("Impressao pelo navegador nao esta disponivel neste ambiente.");
  }

  if (!isUsbPrinterConnected()) {
    await connectUsbPrinter();
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument ?? frameWindow?.document;

  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error("Nao foi possivel preparar a area de impressao.");
  }

  frameDocument.open();
  frameDocument.write(buildReceiptHtml(text));
  frameDocument.close();

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 250);
  });

  frameWindow.focus();
  frameWindow.print();

  window.setTimeout(() => {
    iframe.remove();
  }, 1000);
}

export function getDefaultUsbPrinterName() {
  return DEFAULT_USB_PRINTER_NAME;
}
