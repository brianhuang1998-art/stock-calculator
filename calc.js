const FEE_RATE = 0.001425;
const $ = id => document.getElementById(id);
const fmtInt = n => Math.round(n).toLocaleString('zh-TW');
const fmtSigned = n => (n > 0 ? '+' : '') + fmtInt(n);

const STORAGE_PREFIX = 'pnlCalc:' + location.pathname + ':';
function loadStored(key){
  try { return localStorage.getItem(STORAGE_PREFIX + key); } catch(e){ return null; }
}
function saveStored(key, value){
  try { localStorage.setItem(STORAGE_PREFIX + key, value); } catch(e){}
}

const FIELD_IDS = ['buyPrice','sellPrice','shares','feeDiscount','minFee','taxNormalPct','taxDayPct'];

let selectedMode = 'normal';
let tickType = 'stock';

// Float products like 1000000×0.001425×0.28 come out as 398.99999999999994; the epsilon keeps floor() from dropping 1 元
function floorMoney(x){
  return Math.floor(x + 1e-9);
}

function calcFee(amount, feeDiscount, minFee){
  const fee = floorMoney(amount * FEE_RATE * feeDiscount);
  return Math.max(minFee, fee);
}

function netSellAt(cents, shares, feeDiscount, minFee, taxRate){
  const amount = Math.round(cents / 100 * shares);
  return amount - calcFee(amount, feeDiscount, minFee) - floorMoney(amount * taxRate);
}

// Lowest price (in 0.01 steps) whose net sale proceeds cover the buy cost; searching instead of a closed-form formula keeps the min fee and floor() rounding exact
function breakevenPrice(cost, shares, feeDiscount, minFee, taxRate){
  const keep = 1 - FEE_RATE * feeDiscount - taxRate;
  if(keep <= 0) return null;
  const est = Math.max(cost / (shares * keep), (cost + minFee) / (shares * (1 - taxRate)));
  let cents = Math.max(1, Math.floor((est - 3 / (shares * keep)) * 100) - 1);
  while(netSellAt(cents, shares, feeDiscount, minFee, taxRate) < cost) cents++;
  return cents / 100;
}

function tickCents(cents){
  if(tickType === 'etf') return cents < 5000 ? 1 : 5;
  if(cents < 1000) return 1;
  if(cents < 5000) return 5;
  if(cents < 10000) return 10;
  if(cents < 50000) return 50;
  if(cents < 100000) return 100;
  return 500;
}

function tradablePrice(breakeven, cost, shares, feeDiscount, minFee, taxRate){
  let cents = Math.round(breakeven * 100);
  const t = tickCents(cents);
  cents = Math.ceil(cents / t) * t;
  while(netSellAt(cents, shares, feeDiscount, minFee, taxRate) < cost) cents += tickCents(cents);
  return cents / 100;
}

function calculateTrade(buyPrice, sellPrice, shares, taxRate, feeDiscount, minFee){
  const buyAmount = Math.round(buyPrice * shares);
  const sellAmount = Math.round(sellPrice * shares);
  const grossProfit = sellAmount - buyAmount;

  const buyFee = calcFee(buyAmount, feeDiscount, minFee);
  const sellFee = calcFee(sellAmount, feeDiscount, minFee);
  const tax = floorMoney(sellAmount * taxRate);

  const totalCost = buyFee + sellFee + tax;
  const netPnl = grossProfit - totalCost;
  const roiPct = (netPnl / (buyAmount + buyFee)) * 100;

  const breakeven = breakevenPrice(buyAmount + buyFee, shares, feeDiscount, minFee, taxRate);
  const tradable = breakeven === null ? null : tradablePrice(breakeven, buyAmount + buyFee, shares, feeDiscount, minFee, taxRate);

  return {
    buyAmount, sellAmount, grossProfit, buyFee, sellFee, tax,
    totalCost, netPnl, roiPct, breakeven, tradable
  };
}

function renderDetail(el, r){
  el.innerHTML = `
    <div class="rc-row"><span class="rl">買進金額</span><span class="rv mono">${fmtInt(r.buyAmount)} 元</span></div>
    <div class="rc-row"><span class="rl">賣出金額</span><span class="rv mono">${fmtInt(r.sellAmount)} 元</span></div>
    <div class="rc-row"><span class="rl">帳面毛利</span><span class="rv mono">${fmtSigned(r.grossProfit)} 元</span></div>
    <div class="rc-row"><span class="rl">買進手續費</span><span class="rv mono">${fmtInt(r.buyFee)} 元</span></div>
    <div class="rc-row"><span class="rl">賣出手續費</span><span class="rv mono">${fmtInt(r.sellFee)} 元</span></div>
    <div class="rc-row"><span class="rl">證券交易稅</span><span class="rv mono">${fmtInt(r.tax)} 元</span></div>
    <div class="rc-row"><span class="rl">總交易成本</span><span class="rv mono">${fmtInt(r.totalCost)} 元</span></div>
    <div class="rc-row"><span class="rl">損益兩平點</span><span class="rv mono">${r.breakeven.toFixed(2)} 元</span></div>
    <div class="rc-row"><span class="rl">可掛單兩平價</span><span class="rv mono">${r.tradable.toFixed(2)} 元</span></div>
    <div class="rc-row total"><span class="rl">淨損益</span><span class="rv mono ${r.netPnl >= 0 ? 'profit' : 'loss'}">${fmtSigned(r.netPnl)} 元 (${r.roiPct >= 0 ? '+' : ''}${r.roiPct.toFixed(2)}%)</span></div>
  `;
}

function clearResults(){
  ['sumGross','sumCost','sumRoi'].forEach(id => { $(id).textContent = '--'; });
  ['sumPnl','sumPnlFull','sumPnlDiff'].forEach(id => { $(id).textContent = '--'; $(id).style.color = ''; });
  $('detailNormal').innerHTML = '';
  $('detailDay').innerHTML = '';
  $('gaugeTrack').parentElement.hidden = true;
  $('insightBody').innerHTML = '<p>請輸入有效的數值：買進價、賣出價與股數需大於 0，手續費折數、低消與證交稅率不可為負數。</p>';
}

function updateCalculator(){
  const buyPrice = parseFloat($('buyPrice').value);
  const sellPrice = parseFloat($('sellPrice').value);
  const shares = parseInt($('shares').value, 10);
  const feeDiscount = parseFloat($('feeDiscount').value) / 10;
  const minFee = parseInt($('minFee').value, 10);
  const taxNormalPct = parseFloat($('taxNormalPct').value);
  const taxDayPct = parseFloat($('taxDayPct').value);

  const valid = buyPrice > 0 && sellPrice > 0 && shares > 0
    && feeDiscount >= 0 && minFee >= 0
    && taxNormalPct >= 0 && taxNormalPct < 100 && taxDayPct >= 0 && taxDayPct < 100;
  if(!valid){
    clearResults();
    return;
  }

  $('tabNormalRate').textContent = taxNormalPct;
  $('tabDayRate').textContent = taxDayPct;
  $('badgeNormal').textContent = '稅率 ' + taxNormalPct + '%';
  $('badgeDay').textContent = '稅率 ' + taxDayPct + '%';

  const rNormal = calculateTrade(buyPrice, sellPrice, shares, taxNormalPct / 100, feeDiscount, minFee);
  const rDay = calculateTrade(buyPrice, sellPrice, shares, taxDayPct / 100, feeDiscount, minFee);
  const rNormalFull = calculateTrade(buyPrice, sellPrice, shares, taxNormalPct / 100, 1.0, minFee);
  const rDayFull = calculateTrade(buyPrice, sellPrice, shares, taxDayPct / 100, 1.0, minFee);
  if([rNormal, rDay, rNormalFull, rDayFull].some(r => r.breakeven === null)){
    clearResults();
    return;
  }
  $('gaugeTrack').parentElement.hidden = false;

  renderDetail($('detailNormal'), rNormalFull);
  renderDetail($('detailDay'), rDayFull);

  $('cardNormal').classList.toggle('selected', selectedMode === 'normal');
  $('cardDay').classList.toggle('selected', selectedMode === 'day');

  const sel = selectedMode === 'normal' ? rNormal : rDay;
  const selFull = selectedMode === 'normal' ? rNormalFull : rDayFull;

  $('sumPnlLabel').textContent = selectedMode === 'normal' ? '一般交易' : '現股當沖';
  $('sumGross').textContent = fmtSigned(selFull.grossProfit) + ' 元';
  $('sumCost').textContent = fmtInt(selFull.totalCost) + ' 元';
  $('sumRoi').textContent = (selFull.roiPct >= 0 ? '+' : '') + selFull.roiPct.toFixed(2) + '%';

  $('sumFeeDiscountLabel').textContent = $('feeDiscount').value;
  $('sumPnl').innerHTML = fmtSigned(sel.netPnl) + ' <small>元</small>';
  $('sumPnl').style.color = sel.netPnl >= 0 ? 'var(--accent-strong)' : 'var(--loss)';

  $('sumPnlFull').innerHTML = fmtSigned(selFull.netPnl) + ' <small>元</small>';
  $('sumPnlFull').style.color = selFull.netPnl >= 0 ? 'var(--accent-strong)' : 'var(--loss)';

  const pnlSavings = sel.netPnl - selFull.netPnl;
  $('sumPnlDiff').innerHTML = fmtSigned(pnlSavings) + ' <small>元</small>';
  $('sumPnlDiff').style.color = pnlSavings >= 0 ? 'var(--accent-strong)' : 'var(--loss)';

  const lo = Math.min(buyPrice, selFull.breakeven, sellPrice) * 0.985;
  const hi = Math.max(buyPrice, selFull.breakeven, sellPrice) * 1.015;
  const span = Math.max(hi - lo, 0.01);
  const pct = v => Math.min(100, Math.max(0, ((v - lo) / span) * 100));

  const bePct = pct(selFull.breakeven);
  const sellPct = pct(sellPrice);
  $('gaugeTrack').style.setProperty('--be-pct', bePct + '%');

  // Keep each label fully inside the track instead of letting a long label spill past the card edge
  function positionLabel(el, p){
    const trackW = $('gaugeTrack').clientWidth;
    el.style.transform = 'none';
    el.style.left = '0px';
    const w = el.offsetWidth;
    el.style.left = Math.max(0, Math.min(trackW - w, p / 100 * trackW - w / 2)) + 'px';
  }

  const mBe = $('markerBe'), lBe = $('labelBe'), mSell = $('markerSell'), lSell = $('labelSell');
  mBe.style.left = bePct + '%';
  const tradableText = selFull.tradable !== selFull.breakeven ? '・可掛單 ' + selFull.tradable.toFixed(2) + ' 元' : '';
  lBe.innerHTML = '損益兩平 ' + selFull.breakeven.toFixed(2) + ' 元' + tradableText + '<span class="lbl-note">（手續費原價下・超過才賺錢，低於就賠錢。）</span>';
  positionLabel(lBe, bePct);
  $('gaugeTrack').style.marginTop = (lBe.offsetHeight + 16) + 'px';

  mSell.style.left = sellPct + '%';
  lSell.textContent = '賣出價 ' + sellPrice.toFixed(2) + ' 元';
  positionLabel(lSell, sellPct);
  // Color by the actual net result so the gauge can never disagree with the net P&L shown elsewhere
  const isProfit = selFull.netPnl >= 0;
  mSell.classList.toggle('loss', !isProfit);
  lSell.classList.toggle('profit', isProfit);
  lSell.classList.toggle('loss', !isProfit);

  const diff = sellPrice - selFull.breakeven;
  const diffPct = (diff / selFull.breakeven) * 100;
  const modeName = selectedMode === 'normal' ? '一般交易' : '現股當沖';
  let html = '';
  if(selFull.netPnl >= 0){
    html += `<p>以手續費原價計算（${modeName}），賣出價 <strong>${sellPrice.toFixed(2)}</strong> 元高於損益兩平價 <strong>${selFull.breakeven.toFixed(2)}</strong> 元，預估可獲利 <strong>${fmtSigned(selFull.netPnl)}</strong> 元。</p>`;
  } else {
    html += `<p>以手續費原價計算（${modeName}），賣出價 <strong>${sellPrice.toFixed(2)}</strong> 元低於損益兩平價 <strong>${selFull.breakeven.toFixed(2)}</strong> 元，預估虧損 <strong class="neg">${fmtSigned(selFull.netPnl)}</strong> 元。</p>`;
  }
  const pnlDiff = rDayFull.netPnl - rNormalFull.netPnl;
  let compareLine;
  if(pnlDiff === 0){
    compareLine = '目前一般交易與現股當沖稅率相同，兩者淨損益一致。';
  } else if(pnlDiff > 0){
    compareLine = `現股當沖稅率較低，同樣價差下淨損益較一般交易多約 <strong>${fmtInt(pnlDiff)}</strong> 元。`;
  } else {
    compareLine = `現股當沖稅率較高，同樣價差下淨損益較一般交易少約 <strong>${fmtInt(-pnlDiff)}</strong> 元。`;
  }
  const moveLine = diff >= 0
    ? `賣出價目前領先損益兩平價 <strong>${diffPct.toFixed(2)}%</strong>，可承受賣出價下跌到這個幅度內仍不會虧錢。`
    : `賣出價需再上漲 <strong class="neg">${Math.abs(diffPct).toFixed(2)}%</strong> 才會到達損益兩平點。`;
  const tradableLine = selFull.tradable !== selFull.breakeven
    ? `<li>依升降單位，實際至少要掛 <strong>${selFull.tradable.toFixed(2)}</strong> 元賣出才不會虧錢（手續費原價）。</li>`
    : '';
  html += `<ul>
    <li>${moveLine}</li>
    ${tradableLine}
    <li>${compareLine}</li>
  </ul>`;
  $('insightBody').innerHTML = html;
}

function buildResultText(){
  const modeName = selectedMode === 'normal' ? '一般交易' : '現股當沖';
  return [
    `【損益試算結果】${modeName}`,
    `買進價：${$('buyPrice').value} 元　賣出價：${$('sellPrice').value} 元　股數：${$('shares').value} 股`,
    `淨損益（手續費原價）：${$('sumPnlFull').textContent}`,
    `淨損益（目前 ${$('feeDiscount').value} 折）：${$('sumPnl').textContent}`,
    `折扣省下差價：${$('sumPnlDiff').textContent}`
  ].join('\n');
}

function fallbackCopy(text, done){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(e){}
  document.body.removeChild(ta);
  done();
}

function copyResult(btn){
  const text = buildResultText();
  const originalText = btn.textContent;
  const done = () => {
    btn.textContent = '已複製 ✓';
    btn.classList.add('copied');
    setTimeout(()=>{
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 1500);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function setMode(mode){
  selectedMode = mode;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
  updateCalculator();
}

function applyTaxPreset(normal, day, note){
  $('taxNormalPct').value = normal;
  $('taxDayPct').value = day;
  saveStored('taxNormalPct', normal);
  saveStored('taxDayPct', day);
  if(note !== undefined && $('assetNote')) $('assetNote').textContent = note;
  updateCalculator();
}

function initCalculator(opts){
  if(opts.tickType) tickType = opts.tickType;
  window.addEventListener('resize', updateCalculator);
  const hadSavedTax = loadStored('taxNormalPct') !== null;

  FIELD_IDS.forEach(id=>{
    const saved = loadStored(id);
    if(saved !== null) $(id).value = saved;
    $(id).addEventListener('input', ()=>{
      saveStored(id, $(id).value);
      updateCalculator();
    });
  });

  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      saveStored('mode', btn.dataset.mode);
      setMode(btn.dataset.mode);
    });
  });

  const copyBtn = $('copyResultBtn');
  if(copyBtn){
    copyBtn.addEventListener('click', ()=> copyResult(copyBtn));
  }

  const savedMode = loadStored('mode');
  if(savedMode === 'normal' || savedMode === 'day'){
    selectedMode = savedMode;
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.mode===savedMode));
  }

  if(hadSavedTax){
    if(opts.note !== undefined && $('assetNote')) $('assetNote').textContent = opts.note;
    updateCalculator();
  } else {
    applyTaxPreset(opts.taxNormal, opts.taxDay, opts.note);
  }
}
