const leaveTitle = 'w(ﾟДﾟ)w 别走嘛~';
const backTitle = '♪(^∇^*) Hatrix欢迎你回来~';

let originalTitle = document.title;
let restoreTimer: number | undefined;

document.addEventListener('astro:after-swap', () => {
  window.clearTimeout(restoreTimer);
  originalTitle = document.title;
  if (document.hidden) document.title = leaveTitle;
});

document.addEventListener('visibilitychange', () => {
  window.clearTimeout(restoreTimer);
  if (document.hidden) {
    document.title = leaveTitle;
    return;
  }

  document.title = backTitle;
  restoreTimer = window.setTimeout(() => {
    document.title = originalTitle;
  }, 2_000);
});
