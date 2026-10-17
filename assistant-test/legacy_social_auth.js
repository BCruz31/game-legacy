// Supabase OAuth callback bridge; does not read or overwrite Legacy's character save.
(() => {
  if (window.LegacySocialAuth) return;
  const project = 'https://euqmgzrcccaaupzsdqhj.supabase.co';
  const destination = 'https://bcruz31.github.io/game-legacy/assistant-test/';
  const allowed = new Set(['google', 'apple']);
  let pending = '';
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has('access_token') && hash.has('refresh_token')) {
    pending = JSON.stringify({access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token')});
    history.replaceState(null, '', location.pathname + location.search);
  } else if (hash.has('error_description') || hash.has('error')) {
    pending = JSON.stringify({error: hash.get('error_description') || hash.get('error')});
    history.replaceState(null, '', location.pathname + location.search);
  }
  window.LegacySocialAuth = {
    hasPending() { return !!pending; },
    start(provider) {
      if (!allowed.has(provider)) return false;
      const url = new URL(project + '/auth/v1/authorize');
      url.searchParams.set('provider', provider);
      url.searchParams.set('redirect_to', destination);
      location.assign(url.toString());
      return true;
    },
    take() {
      const value = pending;
      pending = '';
      return value;
    }
  };
})();
