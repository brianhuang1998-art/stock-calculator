import math
from dataclasses import dataclass

@dataclass
class TradeResult:
    trade_type: str
    buy_amount: int
    sell_amount: int
    gross_profit: int
    buy_fee: int
    sell_fee: int
    tax: int
    total_cost: int
    net_pnl: int
    roi_pct: float
    breakeven_price: float

    def display(self):
        sign = "+" if self.net_pnl > 0 else ""
        print(f"=== {self.trade_type} ===")
        print(f"買進金額: {self.buy_amount:>10,d} 元")
        print(f"賣出金額: {self.sell_amount:>10,d} 元")
        print(f"帳面毛利: {self.gross_profit:>10,d} 元")
        print(f"買進手續費: {self.buy_fee:>8,d} 元")
        print(f"賣出手續費: {self.sell_fee:>8,d} 元")
        print(f"證券交易稅: {self.tax:>8,d} 元")
        print(f"總交易成本: {self.total_cost:>8,d} 元")
        print(f"淨損益:   {sign}{self.net_pnl:>9,d} 元 ({self.roi_pct:+.2f}%)")
        print(f"損益兩平點(高於才會盈利): {self.breakeven_price:>8.2f} 元\n")


class StockPnLCalculator:
    FEE_RATE = 0.001425      # 券商法定牌價手續費率 0.1425%
    TAX_NORMAL = 0.003       # 一般交易證交稅 0.3%
    TAX_DAY_TRADE = 0.0015   # 現股當沖證交稅 0.15%

    def __init__(self, fee_discount: float = 0.6, min_fee: int = 20):
        """
        :param fee_discount: 券商手續費折數 (例: 1.0=無折扣, 0.6=6折, 0.28=2.8折)
        :param min_fee: 單筆手續費低消 (台股牌價預設 20 元，零股常有 1 元專案)
        """
        self.fee_discount = fee_discount
        self.min_fee = min_fee

    def _calc_fee(self, amount: int) -> int:
        fee = math.floor(amount * self.FEE_RATE * self.fee_discount)
        return max(self.min_fee, fee)

    def calculate(
        self,
        buy_price: float,
        sell_price: float,
        shares: int = 1000,
        is_day_trading: bool = False
    ) -> TradeResult:
        """計算單筆交易損益"""
        buy_amount = round(buy_price * shares)
        sell_amount = round(sell_price * shares)
        gross_profit = sell_amount - buy_amount

        # 手續費與稅金計算 (小數點一律無條件捨去)
        buy_fee = self._calc_fee(buy_amount)
        sell_fee = self._calc_fee(sell_amount)
        tax_rate = self.TAX_DAY_TRADE if is_day_trading else self.TAX_NORMAL
        tax = math.floor(sell_amount * tax_rate)

        total_cost = buy_fee + sell_fee + tax
        net_pnl = gross_profit - total_cost
        roi_pct = (net_pnl / (buy_amount + buy_fee)) * 100

        # 計算不賠錢的最低賣出價 (損益兩平點)
        # 賣出淨得 = 賣出價金 - 賣出手續費 - 證交稅 >= 買入總成本
        net_multiplier = 1.0 - (self.FEE_RATE * self.fee_discount) - tax_rate
        breakeven_price = (buy_amount + buy_fee) / (shares * net_multiplier)

        return TradeResult(
            trade_type="現股當沖 (稅率 0.15%)" if is_day_trading else "一般交易 (稅率 0.3%)",
            buy_amount=buy_amount,
            sell_amount=sell_amount,
            gross_profit=gross_profit,
            buy_fee=buy_fee,
            sell_fee=sell_fee,
            tax=tax,
            total_cost=total_cost,
            net_pnl=net_pnl,
            roi_pct=roi_pct,
            breakeven_price=round(breakeven_price, 2)
        )

    def compare(self, buy_price: float, sell_price: float, shares: int = 1000):
        """同時列出一般交易與當沖交易的對比"""
        res_normal = self.calculate(buy_price, sell_price, shares, is_day_trading=False)
        res_day = self.calculate(buy_price, sell_price, shares, is_day_trading=True)
        res_normal.display()
        res_day.display()


# --- 互動輸入 ---
if __name__ == "__main__":
    # 依實際交易明細反推：目前帳戶手續費無折扣 (1.0)，低消 20 元
    # 若券商後續有給折扣，請把 fee_discount 改成實際折數 (例: 0.6 = 6折)
    calc = StockPnLCalculator(fee_discount=1.0, min_fee=20)

    buy_price = float(input("請輸入買進價格: "))
    sell_price = float(input("請輸入賣出價格: "))
    shares = int(input("請輸入股數 (直接按 Enter 預設 1000 股=1張): ") or 1000)
    trade_type = input("交易類型 (1=一般交易, 2=現股當沖): ").strip()
    is_day_trading = (trade_type == "2")

    result = calc.calculate(buy_price, sell_price, shares, is_day_trading)
    result.display()