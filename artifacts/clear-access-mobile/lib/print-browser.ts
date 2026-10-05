type PrintWindow = {
  document: {
    open(): void;
    write(markup: string): void;
    close(): void;
  };
  addEventListener(type: 'afterprint', listener: () => void, options?: AddEventListenerOptions): void;
  focus(): void;
  print(): void;
  close(): void;
};

export function printHtmlInBrowserWindow(
  html: string,
  openWindow: () => PrintWindow | null = () => window.open('', '_blank'),
): void {
  const printWindow = openWindow();
  if (!printWindow) {
    throw new Error('The print window was blocked. Allow pop-ups for this app and try again.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
  printWindow.focus();
  printWindow.print();
}