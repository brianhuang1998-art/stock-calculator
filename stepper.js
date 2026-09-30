// Adds larger ▲▼ buttons to every number input inside .input-wrap, including rows added later (e.g. new buy lots)
(function(){
  function enhance(input){
    if(input.dataset.stepper) return;
    const wrap = input.closest('.input-wrap');
    if(!wrap) return;
    input.dataset.stepper = '1';

    const box = document.createElement('div');
    box.className = 'stepper';
    [['up', '▲', '增加'], ['down', '▼', '減少']].forEach(([dir, glyph, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stepper-btn';
      btn.tabIndex = -1;
      btn.textContent = glyph;
      btn.setAttribute('aria-label', label);
      // Keep focus in the input so the page's select-on-focus behaviour doesn't fire on every click
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => {
        if(input.disabled) return;
        try { dir === 'up' ? input.stepUp() : input.stepDown(); } catch(e){ return; }
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      box.appendChild(btn);
    });
    wrap.appendChild(box);
  }

  function scan(node){
    if(node.matches && node.matches('.input-wrap input[type="number"]')) enhance(node);
    else if(node.querySelectorAll) node.querySelectorAll('.input-wrap input[type="number"]').forEach(enhance);
  }

  scan(document);
  new MutationObserver(records => {
    records.forEach(r => r.addedNodes.forEach(n => { if(n.nodeType === 1) scan(n); }));
  }).observe(document.body, { childList: true, subtree: true });
})();
