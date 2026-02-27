// CloudWatch RUM loader for Pinchtab static site.
// TODO: Create RUM app monitor in AWS Console and replace these values.
const RUM_APP_MONITOR_ID = '23e90f4d-9394-4d2a-ac16-95c43e70f6c8';
const RUM_IDENTITY_POOL_ID = 'us-east-1:26c86942-2008-4036-b1ad-cd94758d4e7c';
const RUM_APP_VERSION = '1.0.0';
const RUM_REGION = 'us-east-1';
const RUM_CLIENT_SRC =
  'https://client.rum.us-east-1.amazonaws.com/1.x/cwr.js';

const RUM_CONFIG = {
  sessionSampleRate: 1,
  identityPoolId: RUM_IDENTITY_POOL_ID,
  endpoint: 'https://dataplane.rum.us-east-1.amazonaws.com',
  telemetries: ['performance', 'errors', 'http'],
  allowCookies: true,
  enableXRay: false,
};

function sanitizeReferrer(referrer) {
  if (!referrer) return null;
  try {
    const refUrl = new URL(referrer);
    return `${refUrl.origin}${refUrl.pathname}`;
  } catch {
    return referrer.split('?')[0].split('#')[0];
  }
}

function getTrafficSource() {
  const params = new URLSearchParams(window.location.search);
  const source = {
    referrer: sanitizeReferrer(document.referrer),
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
  };
  return Object.values(source).some((v) => v) ? source : null;
}

(() => {
  if (!RUM_APP_MONITOR_ID || RUM_APP_MONITOR_ID.startsWith('REPLACE_') || !RUM_REGION) return;

  (function (n, i, v, r, s, c, u, x, z) {
    x = window.AwsRumClient = { q: [], n: n, i: i, v: v, r: r, c: c, u: u };
    window[n] = function (c, p) { x.q.push({ c: c, p: p }); };
    z = document.createElement('script');
    z.async = true;
    z.src = s;
    document.head.insertBefore(z, document.getElementsByTagName('script')[0]);
  })('cwr', RUM_APP_MONITOR_ID, RUM_APP_VERSION, RUM_REGION, RUM_CLIENT_SRC, RUM_CONFIG);

  const trafficSource = getTrafficSource();
  if (trafficSource && typeof window.cwr === 'function') {
    window.cwr('recordEvent', 'traffic_source', trafficSource);
  }
})();
