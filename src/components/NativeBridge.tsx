"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Capacitor integration: hardware back button, status bar, keyboard. No-op on the web. */
export default function NativeBridge() {
  const router = useRouter();
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      document.documentElement.classList.add("native");
      const [{ App }, { StatusBar, Style }, { Keyboard }] = await Promise.all([
        import("@capacitor/app"), import("@capacitor/status-bar"), import("@capacitor/keyboard"),
      ]);
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: "#0B0B1E" }).catch(() => {});
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && window.history.length > 1) router.back();
        else App.exitApp();
      });
      const show = await Keyboard.addListener("keyboardWillShow", () => document.body.classList.add("keyboard-open"));
      const hide = await Keyboard.addListener("keyboardWillHide", () => document.body.classList.remove("keyboard-open"));
      cleanup = () => { back.remove(); show.remove(); hide.remove(); };
    })().catch(() => {});
    return () => cleanup?.();
  }, [router]);
  return null;
}
