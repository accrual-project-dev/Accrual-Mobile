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

@main
struct AccrualWidgetBundle: WidgetBundle {
    var body: some Widget {
        AccrualCoreHomeWidgets().body
        AccrualAdvancedHomeWidgets().body
        LockScreenAccessoriesWidget()
    }
}
