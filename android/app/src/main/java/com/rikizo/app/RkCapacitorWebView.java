package com.rikizo.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;

import com.getcapacitor.CapacitorWebView;

/**
 * RkCapacitorWebView — CapacitorWebView subclass that can suppress the OS text
 * selection toolbar (Copy / Share / Web-search floating bar) while keeping the
 * selection itself, so the in-app 説明 pill isn't covered.
 *
 * Why a WebView subclass (not just Activity.onActionModeStarted): on modern Android
 * the floating selection toolbar is repopulated ASYNCHRONOUSLY by the text classifier
 * (it calls ActionMode.invalidate() after the mode starts), so clearing the menu once
 * in onActionModeStarted doesn't stick. Wrapping the ActionMode.Callback and clearing
 * the menu in onPrepareActionMode catches every (re)population, leaving an empty —
 * therefore invisible — toolbar while the selection stays alive.
 *
 * Gated on MainActivity.suppressSelectionMenu (set from JS via the RkSelection bridge
 * only while 説明 mode is on), so ordinary text inputs keep copy/paste.
 *
 * Wired in via android/app/src/main/res/layout/capacitor_bridge_layout_main.xml, which
 * overrides Capacitor's layout to inflate this class instead of CapacitorWebView.
 *
 * NOTE: android/ is gitignored — documented in docs/android.md.
 */
public class RkCapacitorWebView extends CapacitorWebView {

    public RkCapacitorWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    private boolean shouldSuppress() {
        return MainActivity.suppressSelectionMenu;
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback) {
        return super.startActionMode(wrap(callback));
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        return super.startActionMode(wrap(callback), type);
    }

    private ActionMode.Callback wrap(ActionMode.Callback callback) {
        if (callback instanceof ActionMode.Callback2) {
            return new SuppressingCallback2((ActionMode.Callback2) callback);
        }
        return new SuppressingCallback(callback);
    }

    private class SuppressingCallback implements ActionMode.Callback {
        final ActionMode.Callback inner;

        SuppressingCallback(ActionMode.Callback inner) {
            this.inner = inner;
        }

        @Override
        public boolean onCreateActionMode(ActionMode mode, Menu menu) {
            boolean r = inner.onCreateActionMode(mode, menu);
            if (shouldSuppress()) menu.clear();
            return r;
        }

        @Override
        public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
            boolean r = inner.onPrepareActionMode(mode, menu);
            if (shouldSuppress()) {
                menu.clear();
                return true;
            }
            return r;
        }

        @Override
        public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
            return inner.onActionItemClicked(mode, item);
        }

        @Override
        public void onDestroyActionMode(ActionMode mode) {
            inner.onDestroyActionMode(mode);
        }
    }

    private class SuppressingCallback2 extends ActionMode.Callback2 {
        final ActionMode.Callback2 inner;

        SuppressingCallback2(ActionMode.Callback2 inner) {
            this.inner = inner;
        }

        @Override
        public boolean onCreateActionMode(ActionMode mode, Menu menu) {
            boolean r = inner.onCreateActionMode(mode, menu);
            if (shouldSuppress()) menu.clear();
            return r;
        }

        @Override
        public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
            boolean r = inner.onPrepareActionMode(mode, menu);
            if (shouldSuppress()) {
                menu.clear();
                return true;
            }
            return r;
        }

        @Override
        public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
            return inner.onActionItemClicked(mode, item);
        }

        @Override
        public void onDestroyActionMode(ActionMode mode) {
            inner.onDestroyActionMode(mode);
        }

        @Override
        public void onGetContentRect(ActionMode mode, View view, android.graphics.Rect outRect) {
            inner.onGetContentRect(mode, view, outRect);
        }
    }
}
