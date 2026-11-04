chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'BENCH_BOSS_CAPTURE_ESPN') return;

  chrome.cookies.getAll({ domain: '.espn.com' }, (cookies) => {
    const getCookie = (name) => cookies.find(cookie => cookie.name.toLowerCase() === name.toLowerCase())?.value;
    const espnS2 = getCookie('espn_s2');
    const swid = getCookie('SWID');

    if (!espnS2 || !swid) {
      sendResponse({ ok: false, error: 'ESPN login cookies were not found. Sign in to ESPN, then try again.' });
      return;
    }

    sendResponse({
      ok: true,
      espnS2,
      swid,
      sourceUrl: sender.tab?.url || '',
    });
  });

  return true;
});
