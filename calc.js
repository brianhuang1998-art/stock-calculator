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

function calcFee(amount, feeDiscount, minFee){
  const fee = Math.floor(amount * FEE_RATE * feeDiscount);
  return Math.max(minFee, fee);
}

function calculateTrade(buyPrice, sellPrice, shares, taxRate, feeDiscount, minFee){
  const buyAmount = Math.round(buyPrice * shares);
  const sellAmount = Math.round(sellPrice * shares);
  const grossProfit = sellAmount - buyAmount;

  const buyFee = calcFee(buyAmount, feeDiscount, minFee);
  const sellFee = calcFee(sellAmount, feeDiscount, minFee);
  const tax = Math.floor(sellAmount * taxRate);

  const totalCost = buyFee + sellFee + tax;
  const netPnl = grossProfit - totalCost;
  const roiPct = (netPnl / (buyAmount + buyFee)) * 100;

  const netMultiplier = 1.0 - (FEE_RATE * feeDiscount) - taxRate;
  const breakeven = (buyAmount + buyFee) / (shares * netMultiplier);

  return {
    buyAmount, sellAmount, grossProfit, buyFee, sellFee, tax,
    totalCost, netPnl, roiPct, breakeven: Math.round(breakeven * 100) / 100
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
    <div class="rc-row total"><span class="rl">淨損益</span><span class="rv mono ${r.netPnl >= 0 ? 'profit' : 'loss'}">${fmtSigned(r.netPnl)} 元 (${r.roiPct >= 0 ? '+' : ''}${r.roiPct.toFixed(2)}%)</span></div>
  `;
}

function updateCalculator(){
  const buyPrice = parseFloat($('buyPrice').value);
  const sellPrice = parseFloat($('sellPrice').value);
  const shares = parseInt($('shares').value, 10);
  const feeDiscount = parseFloat($('feeDiscount').value) / 10;
  const minFee = parseInt($('minFee').value, 10);
  const taxNormalPct = parseFloat($('taxNormalPct').value);
  const taxDayPct = parseFloat($('taxDayPct').value);

  if(!isFinite(buyPrice) || !isFinite(sellPrice) || !shares || shares <= 0 || !isFinite(feeDiscount) || !isFinite(minFee) || !isFinite(taxNormalPct) || !isFinite(taxDayPct)){
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

  const lo = Math.min(buyPrice, selFull.breakeven, sellPrice) * 0.985;
  const hi = Math.max(buyPrice, selFull.breakeven, sellPrice) * 1.015;
  const span = Math.max(hi - lo, 0.01);
  const pct = v => Math.min(100, Math.max(0, ((v - lo) / span) * 100));

  const bePct = pct(selFull.breakeven);
  const sellPct = pct(sellPrice);
  $('gaugeTrack').style.setProperty('--be-pct', bePct + '%');

  const mBe = $('markerBe'), lBe = $('labelBe'), mSell = $('markerSell'), lSell = $('labelSell');
  mBe.style.left = bePct + '%';
  lBe.style.left = bePct + '%';
  lBe.innerHTML = '損益兩平 ' + selFull.breakeven.toFixed(2) + ' 元<span class="lbl-note">（手續費原價・超過才賺錢，低於就賠錢。）</span>';

  mSell.style.left = sellPct + '%';
  lSell.style.left = sellPct + '%';
  lSell.textContent = '賣出價 ' + sellPrice.toFixed(2) + ' 元';
  const isProfit = sellPrice >= selFull.breakeven;
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
  html += `<ul>
    <li>賣出價需再變動 <strong class="${diff>=0?'':'neg'}">${diff>=0?'+':''}${diffPct.toFixed(2)}%</strong> 才會落在兩平點。</li>
    <li>現股當沖稅率較低，同樣價差下淨損益較一般交易多約 <strong>${fmtInt(rDayFull.netPnl - rNormalFull.netPnl)}</strong> 元。</li>
  </ul>`;
  $('insightBody').innerHTML = html;
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
