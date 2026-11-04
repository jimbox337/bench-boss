const announce = () => window.dispatchEvent(new CustomEvent('BENCH_BOSS_EXTENSION_READY'));
window.addEventListener('BENCH_BOSS_EXTENSION_PING', announce);
announce();
