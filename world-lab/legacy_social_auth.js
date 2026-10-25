// Google OAuth return bridge. Never log tokens or modify character storage.
(() => {
  if (window.LegacySocialAuth) return;
  const project = 'https://euqmgzrcccaaupzsdqhj.supabase.co';
  // The exact candidate URL must be allowlisted in Supabase before testing.
  const destination = new URL('./', location.href).href;
  const memory = new Map();
  const storage = {
    getItem(key) {
      try { return sessionStorage.getItem(key) ?? memory.get(key) ?? null; }
      catch (_) { return memory.get(key) ?? null; }
    },
    setItem(key, value) {
      memory.set(key, value);
      try { sessionStorage.setItem(key, value); } catch (_) {}
    },
    removeItem(key) {
      memory.delete(key);
      try { sessionStorage.removeItem(key); } catch (_) {}
    }
  };
  const pendingKey = 'legacy_google_oauth_pending:' + destination;
  const startedKey = 'legacy_google_oauth_started:' + destination;
  const statusKey = 'legacy_google_oauth_status:' + destination;
  let pending = storage.getItem(pendingKey) || '';
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  if (hash.has('access_token') && hash.has('refresh_token')) {
    pending = JSON.stringify({access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token')});
    storage.setItem(pendingKey, pending);
    storage.setItem(statusKey, 'Google returned credentials; verifying account');
    storage.removeItem(startedKey);
    history.replaceState(null, '', location.pathname + location.search);
  } else if (hash.has('error') || query.has('error')) {
    const message = hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error');
    pending = JSON.stringify({error: message});
    storage.setItem(pendingKey, pending);
    storage.setItem(statusKey, 'Google returned an authentication error');
    storage.removeItem(startedKey);
    history.replaceState(null, '', location.pathname);
  } else if (query.has('code')) {
    pending = JSON.stringify({error: 'Authorization-code callback is unsupported by this implicit-flow build. No character was changed.'});
    storage.setItem(pendingKey, pending);
    storage.setItem(statusKey, 'OAuth flow mismatch');
    history.replaceState(null, '', location.pathname);
  } else if (storage.getItem(startedKey) === 'yes' && !pending) {
    storage.setItem(statusKey, 'Google returned without a session; check browser redirect');
  }
  window.LegacySocialAuth = {
    hasPending() { return !!pending; },
    setAccountMode(mode) { storage.setItem('legacy_account_mode:' + destination, mode); },
    takeAccountMode() {
      const key = 'legacy_account_mode:' + destination;
      const mode = storage.getItem(key) || '';
      storage.removeItem(key);
      return mode;
    },
    status() { return storage.getItem(statusKey) || 'Not connected'; },
    start(provider) {
      if (provider !== 'google') return false;
      storage.setItem(startedKey, 'yes');
      storage.setItem(statusKey, 'Redirecting to Google');
      const url = new URL(project + '/auth/v1/authorize');
      url.searchParams.set('provider', provider);
      // This bridge consumes access/refresh tokens from the URL fragment.
      // Explicitly request implicit flow instead of a PKCE code we cannot exchange.
      url.searchParams.set('flow_type', 'implicit');
      url.searchParams.set('redirect_to', destination);
      location.assign(url.toString());
      return true;
    },
    offerPasswordSave(email, encodedPassword) {
      if (!email || !encodedPassword) return false;
      const wantsSave = window.confirm('Save your Legacy five-icon password to this phone?\\n\\nYour phone may offer Apple Passwords or Google Password Manager.');
      if (!wantsSave) return true;
      if (!navigator.credentials || !window.PasswordCredential) {
        window.alert('This browser cannot request password-manager saving. Open Legacy in Safari or Chrome to use supported password saving.');
        return true;
      }
      try {
        const credential = new PasswordCredential({
          id: email.trim().toLowerCase(),
          password: encodedPassword,
          name: 'Legacy'
        });
        navigator.credentials.store(credential).catch(() => {
          window.alert('Password saving was not completed. You can still sign in with your five icons.');
        });
      } catch (_error) {
        window.alert('Password saving is unavailable in this browser. Your Legacy account remains usable.');
      }
      return true;
    },
    take() { return pending; },
    acknowledge() {
      pending = '';
      storage.removeItem(pendingKey);
    }
  };
})();
