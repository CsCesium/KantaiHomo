import { readShipMod } from './store';

export function shipModInterceptor(event: OnInterceptRequestEvent): WebResourceResponse | null {
  if (!event?.request || event.request.getRequestMethod() !== 'GET') return null;
  const data = readShipMod(event.request.getRequestUrl());
  if (!data) return null;
  const response = new WebResourceResponse();
  response.setResponseCode(200);
  response.setReasonMessage('OK');
  response.setResponseMimeType('image/png');
  response.setResponseData(data);
  response.setResponseHeader([
    { headerKey: 'Content-Type', headerValue: 'image/png' },
    { headerKey: 'Content-Length', headerValue: `${data.byteLength}` },
    { headerKey: 'Cache-Control', headerValue: 'no-store' },
    { headerKey: 'Access-Control-Allow-Origin', headerValue: '*' },
  ]);
  return response;
}
