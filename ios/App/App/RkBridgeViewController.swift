import UIKit
import WebKit
import Capacitor

/**
 RkBridgeViewController — Capacitor host with one customization.

 While 説明 (select-to-explain) mode is on, the web layer (app/shared/select-explain.js)
 posts to the `rkSelection` script-message handler asking us to suppress the OS text
 selection menu (the Copy / Look Up / Translate callout) so it doesn't cover the in-app
 説明 pill. We do that by returning a `RkWebView` whose `canPerformAction` refuses the
 edit-menu actions while suppression is on. The selection itself stays, so the web layer
 can still read it. Gated on 説明 mode, so normal text inputs keep their copy/paste menu.

 Wiring: Main.storyboard's view controller customClass is set to RkBridgeViewController
 (module App) instead of the stock CAPBridgeViewController.

 ⚠️ NOTE: ios/ is gitignored — this file + the storyboard edit are documented in
 docs/ios-native.md. On iOS 16+ the selection menu is driven by UIEditMenuInteraction;
 `canPerformAction` suppresses it in testing, but VERIFY ON A DEVICE before the next
 TestFlight. If a residual menu shows on iOS 16+, add the WKUIDelegate
 `webView(_:editMenuForTextIn:suggestedActions:)` returning an empty UIMenu.
 */
class RkWebView: WKWebView {
    var suppressSelectionMenu = false

    // Legacy (pre-iOS 16) UIMenuController path.
    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        if suppressSelectionMenu {
            return false
        }
        return super.canPerformAction(action, withSender: sender)
    }

    // iOS 16+ drives the text-selection menu through UIEditMenuInteraction, which
    // builds from the responder chain's menu. Removing the standard edit groups here
    // empties the menu while leaving the selection intact. Unknown identifiers are a
    // safe no-op, so we strip generously across iOS versions.
    override func buildMenu(with builder: UIMenuBuilder) {
        if suppressSelectionMenu {
            builder.remove(menu: .standardEdit)  // Cut / Copy / Paste / Select All
            builder.remove(menu: .replace)
            builder.remove(menu: .lookup)        // Look Up / Translate / Search Web
            builder.remove(menu: .share)
            builder.remove(menu: .find)
            builder.remove(menu: .learn)
            builder.remove(menu: .format)
        }
        super.buildMenu(with: builder)
    }
}

class RkBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {

    private weak var rkWebView: RkWebView?

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.add(self, name: "rkSelection")
        let wv = RkWebView(frame: frame, configuration: configuration)
        rkWebView = wv
        return wv
    }

    func userContentController(_ userContentController: WKUserContentController,
                              didReceive message: WKScriptMessage) {
        guard message.name == "rkSelection" else { return }
        let on = (message.body as? Bool) ?? ((message.body as? NSNumber)?.boolValue ?? false)
        rkWebView?.suppressSelectionMenu = on
    }
}
