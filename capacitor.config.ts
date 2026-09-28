import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Android shell for the SAME Next.js app (one codebase).
 * The app is server-rendered (auth, AI proxy, DB), so the native WebView loads the deployed URL.
 * Set CAP_SERVER_URL to your deployment before `npx cap sync android`.
 */
const config: CapacitorConfig = {
  appId: "ai.learnflow.app",
  appName: "LearnFlow AI",
  webDir: "capacitor/www",
  backgroundColor: "#0B0B1E",
  server: {
    url: process.env.CAP_SERVER_URL || "http://10.0.2.2:3000",
    cleartext: !process.env.CAP_SERVER_URL?.startsWith("https"),
    androidScheme: "https",
  },
  android: { allowMixedContent: false },
  plugins: {
    Keyboard: { resize: KeyboardResize.Body, resizeOnFullScreen: true },
    StatusBar: { style: "DARK", backgroundColor: "#0B0B1E", overlaysWebView: false },
  },
};

export default config;
