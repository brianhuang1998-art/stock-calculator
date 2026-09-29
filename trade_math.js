// Shared Taiwan-stock trading math. feeDiscount is a fraction (2.8 折 = 0.28); taxRate is a fraction (0.3% = 0.003).
const FEE_RATE = 0.001425;

// Float products like 1000000×0.001425×0.28 come out as 398.99999999999994; the epsilon keeps floor() from dropping 1 元
function floorMoney(x){
  return Math.floor(x + 1e-9);
}

function calcFee(amount, feeDiscount, minFee){
  return Math.max(minFee, floorMoney(amount * FEE_RATE * feeDiscount));
}

function sellNet(price, shares, feeDiscount, minFee, taxRate){
  const amount = price * shares;
  return amount - calcFee(amount, feeDiscount, minFee) - floorMoney(amount * taxRate);
}

// Lowest price (0.01 steps) whose net sale proceeds cover the cost; searching instead of a closed-form formula keeps the min fee and floor() rounding exact
function breakevenPrice(cost, shares, feeDiscount, minFee, taxRate){
  const keep = 1 - FEE_RATE * feeDiscount - taxRate;
  if(keep <= 0) return null;
  const est = Math.max(cost / (shares * keep), (cost + minFee) / (shares * (1 - taxRate)));
  let cents = Math.max(1, Math.floor((est - 3 / (shares * keep)) * 100) - 1);
  while(sellNet(cents / 100, shares, feeDiscount, minFee, taxRate) < cost) cents++;
  return cents / 100;
}

// Taiwan tick sizes, in cents. tickType: 'stock' or 'etf'
function tickCents(cents, tickType){
  if(tickType === 'etf') return cents < 5000 ? 1 : 5;
  if(cents < 1000) return 1;
  if(cents < 5000) return 5;
  if(cents < 10000) return 10;
  if(cents < 50000) return 50;
  if(cents < 100000) return 100;
  return 500;
}

function nearestTickPrice(price, tickType){
  const cents = Math.round(price * 100);
  const t = tickCents(cents, tickType);
  return Math.round(cents / t) * t / 100;
}

// Break-even raised to the first price that can actually be placed as an order; null when the tick rule is unknown
function tradablePrice(breakeven, tickType, cost, shares, feeDiscount, minFee, taxRate){
  if(breakeven === null || (tickType !== 'stock' && tickType !== 'etf')) return null;
  let cents = Math.round(breakeven * 100);
  const t = tickCents(cents, tickType);
  cents = Math.ceil(cents / t) * t;
  while(sellNet(cents / 100, shares, feeDiscount, minFee, taxRate) < cost) cents += tickCents(cents, tickType);
  return cents / 100;
}

function calculateTrade(buyPrice, sellPrice, shares, taxRate, feeDiscount, minFee, tickType){
  const buyAmount = buyPrice * shares;
  const sellAmount = sellPrice * shares;
  const grossProfit = sellAmount - buyAmount;

  const buyFee = calcFee(buyAmount, feeDiscount, minFee);
  const sellFee = calcFee(sellAmount, feeDiscount, minFee);
  const tax = floorMoney(sellAmount * taxRate);

  const totalCost = buyFee + sellFee + tax;
  const netPnl = grossProfit - totalCost;
  const roiPct = (netPnl / (buyAmount + buyFee)) * 100;

  const breakeven = breakevenPrice(buyAmount + buyFee, shares, feeDiscount, minFee, taxRate);
  const tradable = tradablePrice(breakeven, tickType, buyAmount + buyFee, shares, feeDiscount, minFee, taxRate);

  return {
    buyAmount, sellAmount, grossProfit, buyFee, sellFee, tax,
    totalCost, netPnl, roiPct, breakeven, tradable
  };
}
