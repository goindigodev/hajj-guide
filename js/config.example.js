/* ─────────────────────────────────────────────────────────────
   CONFIG — COPY THIS FILE TO `config.js` AND ADD YOUR API KEYS
   `config.js` is gitignored. Never commit your real keys.
   ───────────────────────────────────────────────────────────── */

window.APP_CONFIG = {
  // Get your key at https://console.cloud.google.com/
  // IMPORTANT: Lock this key with HTTP referrer restrictions to your domain only.
  // Required APIs to enable:
  //   - Maps Embed API (free, no quota)
  //   - Places API (paid after free tier — set strict daily quota)
  googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY_HERE",

  // Set to true once API is set up so the Places autocomplete loads
  enablePlacesAutocomplete: false,

  // Optional analytics endpoint (leave null to disable)
  analyticsUrl: null,
};
