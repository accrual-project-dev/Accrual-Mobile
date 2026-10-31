import WidgetKit
import SwiftUI

struct AccrualCoreHomeWidgets: WidgetBundle {
    var body: some Widget {
        SafeToSpendWidget()
        NetWorthHorizonWidget()
        PortfolioAllocationWidget()
        LiquidCashRunwayWidget()
        SavingsRateRingWidget()
        MonthlyCashflowBarWidget()
    }
}

struct AccrualAdvancedHomeWidgets: WidgetBundle {
    var body: some Widget {
        CapitalHealthWidget()
        BalanceSheetWidget()
        SpendingStabilityWidget()
        ActivityMatrixWidget()
        QuickLogStationWidget()
        VelocityInsightWidget()
        SubscriptionRadarWidget()
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

@available(iOS 18.0, *)
struct AccrualControlWidgets: WidgetBundle {
    var body: some Widget {
        AccrualQuickAddControl()
        AccrualScanControl()
        AccrualVoiceControl()
        AccrualDraftReviewControl()
    }
}

@main
struct AccrualWidgetBundle: WidgetBundle {
    var body: some Widget {
        AccrualCoreHomeWidgets().body
        AccrualAdvancedHomeWidgets().body
        AccrualLockScreenWidgets().body
        if #available(iOS 18.0, *) {
            AccrualControlWidgets().body
        }
    }
}
