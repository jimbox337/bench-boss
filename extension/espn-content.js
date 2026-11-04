(async function () {
  if (location.hash.includes('benchboss-sync')) {
    await chrome.storage.session.set({ benchBossSyncUntil: Date.now() + 10 * 60 * 1000 });
  }
  const { benchBossSyncUntil = 0 } = await chrome.storage.session.get('benchBossSyncUntil');
  if (benchBossSyncUntil < Date.now()) return;
  if (document.getElementById('bench-boss-sync-panel')) return;

  const params = new URL(location.href).searchParams;
  const pathMatch = location.pathname.match(/league(?:Id)?[\/=](\d+)/i);
  const leagueId = params.get('leagueId') || pathMatch?.[1] || '';
  const now = new Date();
  const seasonId = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();

  const panel = document.createElement('section');
  panel.id = 'bench-boss-sync-panel';
  panel.style.cssText = 'position:fixed;right:20px;top:76px;z-index:2147483647;width:330px;padding:20px;border:1px solid #183a5a;background:#071b2c;color:#fff;box-shadow:0 18px 55px rgba(0,0,0,.35);font-family:Inter,Arial,sans-serif';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <img src="https://www.benchboss.pro/icon.png" width="38" height="38" style="border-radius:8px" alt="">
      <div><strong style="font-size:16px">Bench Boss Sync</strong><div style="font-size:12px;color:#9fb4c5">ESPN Fantasy Hockey</div></div>
      <button id="bb-close" style="margin-left:auto;border:0;background:transparent;color:#9fb4c5;font-size:20px;cursor:pointer">×</button>
    </div>
    <p id="bb-copy" style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#d7e1ea">${leagueId ? `League ${leagueId} is ready to connect.` : 'Open the ESPN hockey league you want to sync, then reopen this panel.'}</p>
    <button id="bb-connect" ${leagueId ? '' : 'disabled'} style="width:100%;border:0;background:#12a3a7;color:#04161f;padding:11px 14px;font-weight:700;cursor:${leagueId ? 'pointer' : 'not-allowed'};opacity:${leagueId ? '1' : '.5'}">Connect to Bench Boss</button>
  `;
  document.body.appendChild(panel);

  panel.querySelector('#bb-close').addEventListener('click', () => panel.remove());
  panel.querySelector('#bb-connect').addEventListener('click', () => {
    const button = panel.querySelector('#bb-connect');
    const copy = panel.querySelector('#bb-copy');
    button.disabled = true;
    button.textContent = 'Connecting…';

    chrome.runtime.sendMessage({ type: 'BENCH_BOSS_CAPTURE_ESPN' }, (response) => {
      if (!response?.ok) {
        copy.textContent = response?.error || 'Unable to read your ESPN session.';
        button.disabled = false;
        button.textContent = 'Try again';
        return;
      }

      const payload = { leagueId, seasonId, espnS2: response.espnS2, swid: response.swid };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      chrome.storage.session.remove('benchBossSyncUntil');
      location.href = `https://www.benchboss.pro/teams/espn#espn=${encoded}`;
    });
  });
})();
