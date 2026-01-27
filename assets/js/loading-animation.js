const lightAnimationContainer =
  document.getElementsByClassName('light-animation');
const darkAnimationContainer =
  document.getElementsByClassName('dark-animation');
// if (Theme.visualState === 'light') {
//   lightAnimationContainer[0].style.display = 'flex';
//   darkAnimationContainer[0].style.display = 'none';
// } else if (Theme.visualState === 'dark') {
//   darkAnimationContainer[0].style.display = 'flex';
//   lightAnimationContainer[0].style.display = 'none';
// }
darkAnimationContainer[0].style.display = 'flex';
lightAnimationContainer[0].style.display = 'none';

window.addEventListener('load', function () {
  const loadingContainer = document.querySelector('.loading-container');
  const mainContent = document.querySelector('.main-container');
  loadingContainer.style.display = 'none';
  mainContent.style.display = 'block';
});
