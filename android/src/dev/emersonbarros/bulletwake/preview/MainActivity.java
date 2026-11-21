package dev.emersonbarros.bulletwake.preview;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.hardware.input.InputManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.InputDevice;
import android.view.HapticFeedbackConstants;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Locale;

/** Offline production web build, served from packaged assets under a secure local origin. */
public final class MainActivity extends Activity implements InputManager.InputDeviceListener {
    private WebView game;
    private InputManager inputs;
    private volatile boolean controllerConnected;
    private static final String HOST = "appassets.androidplatform.net";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.rgb(4, 13, 33)));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        game = new WebView(this);
        inputs = (InputManager) getSystemService(INPUT_SERVICE);
        inputs.registerInputDeviceListener(this, null);
        updateControllers();
        game.addJavascriptInterface(new MobileBridge(), "BulletWakeAndroid");
        game.setBackgroundColor(Color.rgb(4, 13, 33));
        game.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebView.setWebContentsDebuggingEnabled(true); // Test APK: native inspection, no game DevTools bundle.
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        game.setWebChromeClient(new WebChromeClient());
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost()) || path == null || path.contains("..")) return missing();
                if (path.equals("/")) path = "/index.html";
                try {
                    WebResourceResponse response = new WebResourceResponse(mime(path), null, getAssets().open(path.substring(1)));
                    HashMap<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    response.setResponseHeaders(headers);
                    return response;
                } catch (IOException error) { return missing(); }
            }
        });
        setContentView(game);
        game.setFocusable(true);
        game.setFocusableInTouchMode(true);
        game.requestFocus();
        immersive();
        game.loadUrl("https://" + HOST + "/index.html");
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }
    private void updateControllers() {
        boolean found = false;
        for (int id : InputDevice.getDeviceIds()) {
            InputDevice device = InputDevice.getDevice(id);
            if (device != null && !device.isVirtual() &&
                (device.supportsSource(InputDevice.SOURCE_GAMEPAD) || device.supportsSource(InputDevice.SOURCE_JOYSTICK))) {
                found = true;
                break;
            }
        }
        controllerConnected = found;
        // A lost controller cannot leave the user locked in a touchless orientation.
        if (!found && getRequestedOrientation() == ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE)
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    }
    @Override public void onInputDeviceAdded(int id) { updateControllers(); }
    @Override public void onInputDeviceRemoved(int id) { updateControllers(); }
    @Override public void onInputDeviceChanged(int id) { updateControllers(); }
    private final class MobileBridge {
        @JavascriptInterface public void menuFeedback() {
            // Uses the system touch-feedback preference; no vibration permission or override.
            runOnUiThread(() -> { if (game != null) game.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY); });
        }
        @JavascriptInterface public void vibrate(int ms, int amplitude) {
            final int dur = Math.max(8, Math.min(120, ms));
            final int amp = Math.max(20, Math.min(255, amplitude));
            runOnUiThread(() -> {
                try {
                    Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                    if (v == null || !v.hasVibrator()) return;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(dur, amp));
                    } else {
                        v.vibrate(dur);
                    }
                } catch (Throwable ignored) { }
            });
        }
        @JavascriptInterface public boolean isControllerConnected() { return controllerConnected; }
        @JavascriptInterface public boolean setOrientation(String orientation) {
            if (!"portrait".equals(orientation) && !"landscape".equals(orientation)) return false;
            boolean landscape = "landscape".equals(orientation);
            if (landscape && !controllerConnected) return false;
            runOnUiThread(() -> {
                if (!landscape || controllerConnected)
                    setRequestedOrientation(landscape ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                immersive();
            });
            return true;
        }
    }
    private static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".ogg")) return "audio/ogg";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".wav")) return "audio/wav";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
    @Override public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) immersive();
        if (game != null) game.evaluateJavascript("window.dispatchEvent(new Event('" + (focus ? "focus" : "blur") + "'))", null);
    }
    @Override protected void onPause() {
        if (game != null) { game.evaluateJavascript("window.dispatchEvent(new Event('blur'))", null); game.onPause(); }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (game != null) {
            updateControllers();
            game.onResume();
            if (hasWindowFocus()) game.evaluateJavascript("window.dispatchEvent(new Event('focus'))", null);
        }
        immersive();
    }
    @Override public void onBackPressed() {
        if (game != null) game.evaluateJavascript("(()=>{const emit=type=>window.dispatchEvent(new KeyboardEvent(type,{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true}));emit('keydown');setTimeout(()=>emit('keyup'),100);})()", null);
    }
    @Override protected void onDestroy() {
        if (inputs != null) inputs.unregisterInputDeviceListener(this);
        if (game != null) { game.removeJavascriptInterface("BulletWakeAndroid"); game.destroy(); game = null; }
        super.onDestroy();
    }
}
