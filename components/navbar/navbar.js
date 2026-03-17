(function () {
  function loadNavbar() {
    var placeholder = document.getElementById('site-navbar');
    if (!placeholder) return;

    fetch('/components/navbar/navbar.html', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('导航加载失败');
        return response.text();
      })
      .then(function (html) {
        placeholder.innerHTML = html;

        var currentPage = window.location.pathname.split('/').pop() || 'index.html';
        var links = placeholder.querySelectorAll('.site-navbar__link');
        links.forEach(function (link) {
          var page = link.getAttribute('data-page') || link.getAttribute('href');
          if (page === currentPage) {
            link.classList.add('site-navbar__link--active');
          }
        });

        var toggle = placeholder.querySelector('#navbarMenuToggle');
        var linksContainer = placeholder.querySelector('#navbarLinks');
        if (toggle && linksContainer) {
          toggle.addEventListener('click', function (event) {
            event.stopPropagation();
            linksContainer.classList.toggle('site-navbar__links--open');
          });

          document.addEventListener('click', function (event) {
            if (!linksContainer.contains(event.target) && event.target !== toggle) {
              linksContainer.classList.remove('site-navbar__links--open');
            }
          });
        }

        // 登录区域逻辑
        var loginButton = placeholder.querySelector('#loginButton');
        var avatarEl = placeholder.querySelector('#userAvatar');
        var circleEl = placeholder.querySelector('#userAvatarCircle');
        var nameEl = placeholder.querySelector('#userAvatarName');
        var userMenu = placeholder.querySelector('#userMenu');
        var logoutButton = placeholder.querySelector('#logoutButton');
        var userArea = placeholder.querySelector('#userArea');

        if (loginButton) {
          loginButton.addEventListener('click', function () {
            window.location.href = 'login.html';
          });
        }

        try {
          var stored = localStorage.getItem('zljx_user');

          if (stored) {
            var info = JSON.parse(stored);
            var name = (info && info.username) ? String(info.username) : '用户';
            var initial = name.trim() ? name.trim().charAt(0).toUpperCase() : 'U';

            if (circleEl) circleEl.textContent = initial;
            if (nameEl) nameEl.textContent = name;

            if (avatarEl) avatarEl.style.display = 'flex';
            if (loginButton) loginButton.style.display = 'none';
          } else {
            if (avatarEl) avatarEl.style.display = 'none';
            if (loginButton) loginButton.style.display = 'inline-flex';
          }
        } catch (e) {
          console.error('读取登录信息失败', e);
        }

        if (avatarEl && userMenu) {
          avatarEl.addEventListener('click', function (event) {
            event.stopPropagation();
            if (userMenu.style.display === 'none' || userMenu.style.display === '') {
              userMenu.style.display = 'block';
            } else {
              userMenu.style.display = 'none';
            }
          });
        }

        if (logoutButton) {
          logoutButton.addEventListener('click', function () {
            localStorage.removeItem('zljx_user');
            if (userMenu) userMenu.style.display = 'none';
            if (avatarEl) avatarEl.style.display = 'none';
            if (loginButton) loginButton.style.display = 'inline-flex';
            window.location.href = 'index.html';
          });
        }

        document.addEventListener('click', function (event) {
          if (!userArea || !userMenu) return;
          if (!userArea.contains(event.target)) {
            userMenu.style.display = 'none';
          }
        });
      })
      .catch(function (error) {
        console.error('导航栏加载失败:', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNavbar);
  } else {
    loadNavbar();
  }
})();

