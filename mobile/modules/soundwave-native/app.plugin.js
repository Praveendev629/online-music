// youtubedl-android requires android:extractNativeLibs="true" on the <application>
// element so the bundled Python interpreter + yt-dlp .so libs are unpacked.
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withSoundWaveNative(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (app != null) {
      app.$['android:extractNativeLibs'] = 'true';
    }
    return config;
  });
};