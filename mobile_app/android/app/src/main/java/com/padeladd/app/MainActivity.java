package com.padeladd.app;

import android.content.Context;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // Prevent the WebView from stealing audio focus on startup,
        // which would pause background media (Spotify, YouTube, etc.)
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                android.media.AudioFocusRequest focusRequest = new android.media.AudioFocusRequest.Builder(
                        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setWillPauseWhenDucked(false)
                        .build();
                audioManager.requestAudioFocus(focusRequest);
                audioManager.abandonAudioFocusRequest(focusRequest);
            }
        }
    }
}
