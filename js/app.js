import { getSignedInUser, login, friendlyAuthError, watchSignedOut } from './auth.js';
import { urlFor } from './routes.js';
import { mountShell } from './components.js';
import { setActiveUser, clearAllMedicalSessionData } from './storage.js';
import { showMessage } from './utils.js';

// Static page templates only: the logged-in user and Excel data never leave the browser.
const pages = ['dashboard', 'specialties', 'doctors', 'doctor-details', 'admin'];
const pageTemplates = new Map();

function fetchPageTemplate(page) {
  if (!pages.includes(page)) return Promise.reject(new Error('صفحة غير معروفة.'));

  if (!pageTemplates.has(page)) {
    const task = fetch(urlFor(page), { cache: 'no-cache' })
      .then(async response => {
        if (!response.ok) throw new Error(`تعذر تحميل الصفحة (HTTP ${response.status}).`);
        const html = await response.text();
        const documentTemplate = new DOMParser().parseFromString(html, 'text/html');
        const pageMain = documentTemplate.getElementById('main-content');
        if (!pageMain || documentTemplate.body.dataset.page !== page) {
          throw new Error('ملف الصفحة غير صالح أو لا يطابق القسم المطلوب.');
        }
        return { content: pageMain.innerHTML, title: documentTemplate.title };
      })
      .catch(error => {
        pageTemplates.delete(page); // Retry when the network becomes available.
        throw error;
      });
    pageTemplates.set(page, task);
  }

  return pageTemplates.get(page);
}

async function pageInitializer(page) {
  if (page === 'dashboard') return (await import('./dashboard.js')).initDashboard;
  if (page === 'admin') return (await import('./admin.js')).initAdmin;
  if (['specialties', 'doctors', 'doctor-details'].includes(page)) {
    return (await import('./reports.js')).initReport;
  }
  throw new Error('صفحة غير معروفة.');
}

function routeAtLocation() {
  return pages.find(page => new URL(urlFor(page)).pathname === location.pathname) || null;
}

function enableSmoothNavigation(initialPage, role, uid) {
  const main = document.getElementById('main-content');
  const sidebar = document.getElementById('sidebar-slot');
  if (!main || !sidebar) return;

  let activePage = initialPage;
  let requestNumber = 0;

  function highlightNavigation(pending = null) {
    sidebar.querySelectorAll('a[data-route]').forEach(link => {
      const active = link.dataset.route === activePage;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      link.classList.toggle('nav-pending', link.dataset.route === pending);
    });
    if (pending) main.setAttribute('aria-busy', 'true');
    else main.removeAttribute('aria-busy');
  }

  function showNavigationError(error) {
    let notice = document.getElementById('navigation-error');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'navigation-error';
      notice.setAttribute('role', 'alert');
      main.prepend(notice);
    }
    notice.className = 'alert error';
    notice.textContent = 'تعذر الانتقال إلى القسم المطلوب. بقيت الصفحة الحالية مفتوحة. ' + error.message;
  }

  async function changePage(page, addHistory = true) {
    if (!pages.includes(page) || (page === 'admin' && role !== 'admin')) return;
    const currentRequest = ++requestNumber;

    if (page === activePage) {
      highlightNavigation(); // Also cancel any pending change to another page.
      return;
    }

    // Keep the old page visible while preparing the next one.
    highlightNavigation(page);
    try {
      const [template, start] = await Promise.all([
        fetchPageTemplate(page),
        pageInitializer(page)
      ]);
      if (currentRequest !== requestNumber) return;

      // Inform asynchronous page operations that their view is being removed.
      window.dispatchEvent(new CustomEvent('medmetrics:before-page-change', {
        detail: { from: activePage, to: page }
      }));

      main.classList.remove('page-swap-in');
      main.innerHTML = template.content;
      document.title = template.title;
      document.body.dataset.page = page;
      activePage = page;

      // The destination's event handlers are attached to the NEW main content.
      if (page === 'dashboard') start();
      else if (page === 'admin') start(uid);
      else start(page);

      if (addHistory) history.pushState({ page }, '', urlFor(page));
      main.classList.add('page-swap-in');
      window.scrollTo(0, 0);
    } catch (error) {
      if (currentRequest !== requestNumber) return;
      console.error('Page navigation failed', error);
      showNavigationError(error);
      // When Back/Forward failed, keep the URL synchronized with visible content.
      if (!addHistory) history.replaceState({ page: activePage }, '', urlFor(activePage));
    } finally {
      if (currentRequest === requestNumber) highlightNavigation();
    }
  }

  highlightNavigation();
  sidebar.addEventListener('click', event => {
    const link = event.target.closest('a[data-route]');
    if (!link || !sidebar.contains(link)) return;
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.altKey || event.shiftKey || link.target === '_blank') return;
    event.preventDefault();
    changePage(link.dataset.route);
  });

  window.addEventListener('popstate', () => {
    const page = routeAtLocation();
    if (page) changePage(page, false);
  });

  // Warm the HTML-only page templates at idle time for faster later transitions.
  const prefetch = () => {
    pages.filter(page => role === 'admin' || page !== 'admin')
      .filter(page => page !== initialPage)
      .forEach(page => { fetchPageTemplate(page).catch(() => {}); });
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(prefetch, { timeout: 2000 });
  else setTimeout(prefetch, 800);
}

async function init() {
  const page = document.body.dataset.page;

  if (page === 'login') {
    const { isFirebaseConfigured } = await import('./firebase-config.js');
    if (!isFirebaseConfigured()) {
      showMessage('أدخل إعدادات تطبيق Firebase أولاً في ملف js/firebase-config.js.', 'warning', 'config-notice');
    }
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = document.getElementById('login-submit');
      button.disabled = true;
      try {
        const data = new FormData(form);
        await login(String(data.get('email')).trim(), String(data.get('password')));
        location.replace(urlFor('dashboard'));
      } catch (error) {
        showMessage(friendlyAuthError(error), 'error', 'login-error');
        button.disabled = false;
      }
    });
    try {
      const user = await getSignedInUser();
      if (user?.role) location.replace(urlFor('dashboard'));
    } catch (error) { console.warn(error.message); }
    document.body.dataset.auth = 'ready';
    return;
  }

  try {
    const signedIn = await getSignedInUser();
    if (!signedIn?.role) {
      clearAllMedicalSessionData();
      location.replace(urlFor('login'));
      return;
    }
    if (page === 'index' || (page === 'admin' && signedIn.role !== 'admin')) {
      location.replace(urlFor('dashboard'));
      return;
    }

    setActiveUser(signedIn.user.uid);
    watchSignedOut(() => {
      clearAllMedicalSessionData();
      location.replace(urlFor('login'));
    });

    await mountShell(signedIn.role, signedIn.user.email, page);
    const start = await pageInitializer(page);
    if (page === 'dashboard') start();
    else if (page === 'admin') start(signedIn.user.uid);
    else start(page);
    enableSmoothNavigation(page, signedIn.role, signedIn.user.uid);
    document.body.dataset.auth = 'ready';
  } catch (error) {
    console.error(error);
    document.body.dataset.auth = 'ready';
    const main = document.getElementById('main-content') || document.querySelector('main') || document.body;
    main.replaceChildren();
    const alert = document.createElement('div');
    alert.className = 'alert error';
    alert.textContent = 'فشل بدء التطبيق: ' + friendlyAuthError(error);
    main.append(alert);
  }
}

init();
