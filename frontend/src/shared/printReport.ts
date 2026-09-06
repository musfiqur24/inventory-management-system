/** Reuse the app's compiled Tailwind styles in a printable document. */
export function printReport(title: string, content: string) {
  const popup = window.open('', '_blank');
  if (!popup) return;

  popup.document.write('<!doctype html><html><head><meta charset="UTF-8"></head><body></body></html>');
  popup.document.title = title;
  popup.document.body.className = 'bg-white p-8 font-sans text-[14px] text-[#111]';
  popup.document.body.innerHTML = content;

  const stylesReady = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((source) => {
    const clone = source.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
    const ready = clone instanceof HTMLLinkElement
      ? new Promise<void>((resolve) => {
          clone.onload = () => resolve();
          clone.onerror = () => resolve();
        })
      : Promise.resolve();
    popup.document.head.appendChild(clone);
    return ready;
  });
  popup.document.close();

  void Promise.all(stylesReady).then(async () => {
    await popup.document.fonts.ready;
    if (!popup.closed) {
      popup.focus();
      popup.print();
    }
  });
}
