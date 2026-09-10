// Where search requests go when the on-device native module is not used.
// Set this to your hosted backend (e.g. https://music-backend.onrender.com)
// only if you are NOT using the on-device yt-dlp module.
// The app tries the native module first (src/extractor.ts).
export const API_BASE_URL = 'http://10.0.2.2:3001';