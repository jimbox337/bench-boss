document.getElementById('open-espn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.espn.com/fantasy/hockey/#benchboss-sync' });
});
