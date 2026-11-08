"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiArrowRight, FiBell, FiDownload, FiX } from "react-icons/fi";
import { useAuthSession } from "@/components/auth-session-provider";
import { notify } from "@/lib/notify";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const tour = [
  { path: "/explore", selector: ".world", title: "Explore the campus", body: "Look around FUTO and move through the campus experience. On desktop, use WASD to move and the arrow keys to look around." },
  { path: "/explore", selector: ".dock-menu-toggle", title: "Find campus places", body: "Open Menu, then choose Campus directory to search lecture halls, services and other saved places." },
  { path: "/community/feed", selector: ".social-content", title: "Join the community", body: "Browse campus posts, react and comment. You can follow hashtags and tag friends with @." },
  { path: "/community/messages", selector: ".chat-sidebar", title: "Open your conversations", body: "Your newest conversations appear first. You can message friends and create group chats from here." },
  { path: "/community/profile", selector: ".social-content", title: "Set up your profile", body: "Add a profile photo and details so friends can recognize you around FUTO Life." },
];

export function WelcomeGuide() {
  const { status, userId } = useAuthSession();
  const pathname = usePathname();
  const router = useRouter();
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | "unsupported">("default");
  const startedRef = useRef(false);
  const shownInstallRef = useRef(false);
  const tourKey = userId ? `futolife:tour:${userId}` : null;
  const installKey = userId ? `futolife:install-nudge:${userId}` : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rememberPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const rememberInstall = () => { setInstalled(true); setInstallOpen(false); if (installKey) localStorage.setItem(installKey, "installed"); };
    const requestInstall = () => { void installApp(); };
    window.addEventListener("beforeinstallprompt", rememberPrompt);
    window.addEventListener("appinstalled", rememberInstall);
    window.addEventListener("futolife-install-request", requestInstall);
    if ("Notification" in window) setNotificationStatus(window.Notification.permission);
    else setNotificationStatus("unsupported");
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/notifications-sw.js").catch(() => {});
    return () => { window.removeEventListener("beforeinstallprompt", rememberPrompt); window.removeEventListener("appinstalled", rememberInstall); window.removeEventListener("futolife-install-request", requestInstall); };
  }, [installKey, installPrompt]);

  useEffect(() => {
    if (status !== "signed-in" || !tourKey || startedRef.current) return;
    startedRef.current = true;
    if (!localStorage.getItem(tourKey)) setTourStep(0);
  }, [status, tourKey]);

  useEffect(() => {
    if (status !== "signed-in" || !installKey || shownInstallRef.current || tourStep !== null) return;
    const existing = localStorage.getItem(installKey);
    if (existing === "installed" || existing === "dismissed") return;
    const timer = window.setTimeout(() => { setInstallOpen(true); shownInstallRef.current = true; }, 45000);
    return () => window.clearTimeout(timer);
  }, [installKey, status, tourStep]);

  useEffect(() => {
    document.querySelectorAll(".tour-highlight").forEach(node => node.classList.remove("tour-highlight"));
    if (tourStep === null) return;
    const step = tour[tourStep];
    if (!step || pathname !== step.path) return;
    const timer = window.setTimeout(() => document.querySelector(step.selector)?.classList.add("tour-highlight"), 250);
    return () => window.clearTimeout(timer);
  }, [pathname, tourStep]);

  function finishTour() {
    document.querySelectorAll(".tour-highlight").forEach(node => node.classList.remove("tour-highlight"));
    if (tourKey) localStorage.setItem(tourKey, "done");
    setTourStep(null);
  }

  function moveTour(direction: 1 | -1) {
    if (tourStep === null) return;
    const next = tourStep + direction;
    if (next < 0) return;
    if (next >= tour.length) { finishTour(); return; }
    const step = tour[next];
    setTourStep(next);
    if (pathname !== step.path) router.push(step.path);
  }

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") { setInstalled(true); if (installKey) localStorage.setItem(installKey, "installed"); }
      return;
    }
    notify("Use your browser menu and choose ‘Add to Home screen’ or ‘Install FUTO Life’.");
  }

  async function enableNotifications() {
    if (!("Notification" in window)) { setNotificationStatus("unsupported"); return; }
    const permission = await window.Notification.requestPermission();
    setNotificationStatus(permission);
    if (permission === "granted" && userId) {
      localStorage.setItem(`futolife:web-notifications:${userId}`, "enabled");
      window.dispatchEvent(new Event("futolife-notification-preference"));
      notify("Browser notifications are enabled on this device.");
    } else if (permission === "denied") notify("Allow notifications in your browser’s site settings to turn them on.");
  }

  if (status !== "signed-in") return null;
  if (tourStep !== null) {
    const step = tour[tourStep];
    return <div className="welcome-guide-scrim"><section className="welcome-guide-card" role="dialog" aria-modal="true" aria-labelledby="welcome-guide-title"><div className="welcome-guide-progress">FUTO LIFE TOUR · {tourStep + 1} OF {tour.length}</div><h2 id="welcome-guide-title">{step.title}</h2><p>{step.body}</p><div className="welcome-guide-actions"><button className="secondary" onClick={finishTour}>Skip tutorial</button>{tourStep > 0 && <button className="secondary" onClick={() => moveTour(-1)}>Back</button>}<button className="primary" onClick={() => moveTour(1)}>{tourStep === tour.length - 1 ? "Finish" : "Next"}<FiArrowRight/></button></div></section></div>;
  }
  if (!installOpen || installed) return null;
  return <div className="install-nudge-scrim"><section className="install-nudge-card" role="dialog" aria-modal="true" aria-labelledby="install-nudge-title"><button className="install-nudge-close" aria-label="Dismiss" onClick={() => { setInstallOpen(false); if (installKey) localStorage.setItem(installKey, "dismissed"); }}><FiX/></button><span className="install-nudge-icon"><FiDownload/></span><h2 id="install-nudge-title">Keep FUTO Life close</h2><p>Add FUTO Life to your home screen for quick access. You can also enable message and friend request notifications on this device.</p><div className="install-nudge-actions"><button className="primary" onClick={() => void installApp()}><FiDownload/>{installPrompt ? "Add to home screen" : "How to install"}</button>{notificationStatus !== "granted" && notificationStatus !== "unsupported" && <button className="secondary" onClick={() => void enableNotifications()}><FiBell/>Enable notifications</button>}</div><small>Notifications are optional and can be changed in browser settings.</small></section></div>;
}
