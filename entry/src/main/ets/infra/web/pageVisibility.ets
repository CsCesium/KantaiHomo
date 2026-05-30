type WebHostPageVisibleHandler = () => void;

let pageVisibleHandler: WebHostPageVisibleHandler | undefined = undefined;

export function registerWebHostPageVisibleHandler(handler: WebHostPageVisibleHandler): () => void {
  pageVisibleHandler = handler;
  return (): void => {
    if (pageVisibleHandler === handler) {
      pageVisibleHandler = undefined;
    }
  };
}

export function notifyWebHostPageVisible(): void {
  pageVisibleHandler?.();
}
