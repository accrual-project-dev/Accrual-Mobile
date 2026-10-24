import WidgetKit
import SwiftUI

struct AccrualCoreHomeWidgets: WidgetBundle {
    var body: some Widget {
        NetWorthHorizonWidget()
        PortfolioAllocationWidget()
        LiquidCashRunwayWidget()
        SavingsRateRingWidget()
        MonthlyCashflowBarWidget()
    }
}

struct AccrualAdvancedHomeWidgets: WidgetBundle {
    var body: some Widget {
        QuickLogStationWidget()
        CapitalHealthWidget()
        ActivityMatrixWidget()
        BalanceSheetWidget()
        SpendingStabilityWidget()
    }
}

struct AccrualLockScreenWidgets: WidgetBundle {
    var body: some Widget {
        LockScreenNetWorthWidget()
        LockScreenPortfolioWidget()
        LockScreenSavingsRunwayWidget()
        LockScreenSpendingStabilityWidget()
        LockScreenQuickLogWidget()
    }
}

@main
struct AccrualWidgetBundle: WidgetBundle {
    var body: some Widget {
        AccrualCoreHomeWidgets().body
        AccrualAdvancedHomeWidgets().body
        AccrualLockScreenWidgets().body
    }
}
