import { url } from '@kit.ArkTS';

/** Match an exact host or one of its subdomains without accepting lookalike suffixes. */
function isHostInDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * First-party DMM hosts must bypass the generic tracking/ad filters below.
 * dmmapis.com hosts the item-purchase cashier bridge (for example d-af2/api.js),
 * whose follow-up requests may otherwise look like analytics collection calls.
 */
function isDmmFirstPartyHost(host: string): boolean {
  const allowDomains: string[] = [
    'dmm.com',
    'dmm.co.jp',
    'dmmapis.com',
  ];
  for (let i = 0; i < allowDomains.length; i++) {
    if (isHostInDomain(host, allowDomains[i])) return true;
  }
  return false;
}

export function shouldBlock(Url: string): boolean {
  let u:url.URL;
  try {
    u = url.URL.parseURL(Url);
  }catch (_){
    return false;
  }

  const host:string = u.hostname.toLowerCase();
  const path:string = (u.pathname+u.search).toLowerCase();

  // Keep purchase/cashier resources ahead of generic path-based filters.
  if (isDmmFirstPartyHost(host)) return false;

  const blockHosts:string[] = [
    'googlesyndication.com',
    'google-analytics.com',
    'doubleclick.net',
    'pagead2.googlesyndication.com',
    'analytics.twitter.com',
    'ads-twitter.com',
    't.co',
    'bat.bing.com',
    'connect.facebook.net',
    'criteo.com',
    'taboola.com',
    'scorecardresearch.com',
    'snapads.com',
    'hotjar.com',
    'sentry.io',
    'newrelic.com'
  ];
  for (let i = 0; i<blockHosts.length;i++){if (host.endsWith(blockHosts[i])) return true;}

  if(path.indexOf('/pagead/') >= 0 ||
      path.indexOf('/adsct') >= 0 ||
      path.indexOf('gtm.js') >= 0 ||
      path.indexOf('analytics.js') >= 0 ||
      path.indexOf('collect?') >= 0 ||
      path.indexOf('pixel.gif') >= 0){
    return true;
  }
  return false;
}

export function createEmptyResp():WebResourceResponse{
  const resp = new WebResourceResponse();
  resp.setResponseCode(204);
  resp.setReasonMessage('No Content');
  resp.setResponseEncoding('utf-8');
  resp.setResponseMimeType('text/plain');
  resp.setResponseData(new Uint8Array(0));

  const headers= new Array<Header>();
  headers.push({ headerKey: 'Content-Type', headerValue: 'text/plain; charset=utf-8' });
  resp.setResponseHeader(headers);
  return resp;
}
