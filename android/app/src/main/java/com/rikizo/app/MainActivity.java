package com.rikizo.app;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — Capacitor host.
 *
 * Adds one customization beyond the stock template: while 説明 (select-to-explain)
 * mode is on, the web layer asks us to suppress the OS text-selection toolbar (the
 * floating Copy / Share / Web-search bar) so it doesn't cover the in-app 説明 pill.
 * The actual suppression lives in RkCapacitorWebView (it wraps the selection
 * ActionMode and empties the menu on every async repopulation, keeping the selection
 * itself). This class just owns the on/off flag and the JS bridge that toggles it.
 * Gated on 説明 mode, so normal text inputs keep their copy/paste menu.
 *
 * NOTE: android/ is gitignored — this edit is documented in docs/android.md.
 */
public class MainActivity extends BridgeActivity {

    /** Set from JS (RkSelection.setSuppressed) when 説明 mode turns on/off; read by
     *  RkCapacitorWebView. Static so the webview can see it without a back-reference. */
    public static volatile boolean suppressSelectionMenu = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new RkSelectionBridge(), "RkSelection");
        }
    }

    private static class RkSelectionBridge {
        @JavascriptInterface
        public void setSuppressed(boolean on) {
            suppressSelectionMenu = on;
        }
    }
}
