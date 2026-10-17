// Google OAuth return bridge. Never log tokens or modify character storage.
(() => {
  if (window.LegacySocialAuth) return;
  const project = 'https://euqmgzrcccaaupzsdqhj.supabase.co';
  const destination = 'https://bcruz31.github.io/game-legacy/assistant-test/';
  const pendingKey = 'legacy_google_oauth_pending';
  const startedKey = 'legacy_google_oauth_started';
  const statusKey = 'legacy_google_oauth_status';
  let pending = sessionStorage.getItem(pendingKey) || '';
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  if (hash.has('access_token') && hash.has('refresh_token')) {
    pending = JSON.stringify({access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token')});
    sessionStorage.setItem(pendingKey, pending);
    sessionStorage.setItem(statusKey, 'Google returned credentials; verifying account');
    sessionStorage.removeItem(startedKey);
    history.replaceState(null, '', location.pathname + location.search);
  } else if (hash.has('error') || query.has('error')) {
    const message = hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error');
    pending = JSON.stringify({error: message});
    sessionStorage.setItem(pendingKey, pending);
    sessionStorage.setItem(statusKey, 'Google returned an authentication error');
    sessionStorage.removeItem(startedKey);
    history.replaceState(null, '', location.pathname);
  } else if (query.has('code')) {
    sessionStorage.setItem(statusKey, 'Google returned an authorization code; token exchange is required');
  } else if (sessionStorage.getItem(startedKey) === 'yes' && !pending) {
    sessionStorage.setItem(statusKey, 'Google returned without a session; check browser redirect');
  }
  window.LegacySocialAuth = {
    hasPending() { return !!pending; },
    status() { return sessionStorage.getItem(statusKey) || 'Not connected'; },
    start(provider) {
      if (provider !== 'google') return false;
      sessionStorage.setItem(startedKey, 'yes');
      sessionStorage.setItem(statusKey, 'Redirecting to Google');
      const url = new URL(project + '/auth/v1/authorize');
      url.searchParams.set('provider', provider);
      url.searchParams.set('redirect_to', destination);
      location.assign(url.toString());
      return true;
    },
    take() {
      const value = pending;
      pending = '';
      sessionStorage.removeItem(pendingKey);
      return value;
    }
  };
})();