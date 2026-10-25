// Native DOM text entry for iPhone in-app browsers. Never touches game storage.
(() => {
  if (window.LegacyTextInput) return;
  let active = null, completed = null;
  function open(label, initial, kind) {
    if (active) active.remove();
    completed = null;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box';
    const panel = document.createElement('div');
    panel.style.cssText = 'width:min(100%,540px);background:#08152d;border:2px solid #31bfff;border-radius:12px;padding:18px;color:white;font:18px sans-serif';
    const heading = document.createElement('div');
    heading.textContent = label;
    heading.style.marginBottom = '12px';
    const input = document.createElement('input');
    input.type = kind === 'email' ? 'email' : 'text';
    input.autocomplete = kind === 'email' ? 'email' : 'one-time-code';
    input.inputMode = kind === 'email' ? 'email' : 'numeric';
    input.value = initial || '';
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;padding:14px;font:20px sans-serif;background:white;color:#111;border:2px solid #31bfff;border-radius:6px';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:12px;margin-top:16px';
    function button(name, callback) {
      const el = document.createElement('button');
      el.textContent = name;
      el.style.cssText = 'flex:1;padding:14px;font:bold 17px sans-serif;border:0;border-radius:6px;background:#1662a5;color:white';
      el.addEventListener('click', callback);
      return el;
    }
    function finish(value) { completed = value; overlay.remove(); active = null; }
    actions.append(button('CANCEL', () => finish(null)), button('DONE', () => finish(input.value.trim())));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') finish(input.value.trim()); });
    panel.append(heading, input, actions);
    overlay.append(panel);
    document.body.append(overlay);
    active = overlay;
    // User taps this real HTML input to summon the native keyboard.
    input.focus();
  }
  window.LegacyTextInput = {
    open,
    take() {
      if (completed === null) return '';
      const value = completed;
      completed = null;
      return JSON.stringify({value});
    }
  };
})();
