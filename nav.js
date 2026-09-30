// Site-wide "全部工具" dropdown in the top bar; edit TOOL_MENU here when adding a page
(function(){
  const TOOL_MENU = [
    { title: '首頁', href: 'home_page.html', items: [] },
    { title: '試算工具', href: 'tools.html', items: [
      { title: 'ETF 試算', href: 'etf_calculator.html' },
      { title: '個股試算', href: 'stock_calculator.html' },
      { title: '目標%數試算', href: 'target_price_calculator.html' }
    ]},
    { title: '交易與部位管理', href: 'trading_position.html', items: [
      { title: '定期定額複利試算', href: 'dca_calculator.html' },
      { title: '加權平均成本試算', href: 'avg_cost_calculator.html' }
    ]},
    { title: '估值與基本面分析', href: 'valuation_analysis.html', soon: true, items: [] },
    { title: '股息與現金流規劃', href: 'dividend_cashflow.html', soon: true, items: [] }
  ];

  const topbar = document.querySelector('.topbar');
  if(!topbar) return;
  const current = location.pathname.split('/').pop() || 'home_page.html';

  function link(text, href, className){
    const a = document.createElement('a');
    a.href = href;
    a.className = className;
    a.textContent = text;
    if(href === current){
      a.classList.add('current');
      a.setAttribute('aria-current', 'page');
    }
    return a;
  }

  const wrap = document.createElement('div');
  wrap.className = 'tool-menu';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tool-menu-btn';
  btn.textContent = '全部工具 ▾';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'toolMenuPanel');

  const panel = document.createElement('nav');
  panel.className = 'tool-menu-panel';
  panel.id = 'toolMenuPanel';
  panel.hidden = true;
  panel.setAttribute('aria-label', '全部工具');

  TOOL_MENU.forEach(group => {
    const section = document.createElement('div');
    section.className = 'tool-menu-group';
    const head = link(group.title, group.href, 'tool-menu-head');
    if(group.soon){
      const tag = document.createElement('span');
      tag.className = 'tool-menu-soon';
      tag.textContent = '開發中';
      head.appendChild(tag);
    }
    section.appendChild(head);
    group.items.forEach(item => section.appendChild(link(item.title, item.href, 'tool-menu-item')));
    panel.appendChild(section);
  });

  function setOpen(open){
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '全部工具 ▴' : '全部工具 ▾';
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });
  document.addEventListener('click', e => {
    if(!panel.hidden && !wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && !panel.hidden){
      setOpen(false);
      btn.focus();
    }
  });

  wrap.append(btn, panel);
  topbar.appendChild(wrap);
})();
