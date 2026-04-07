import "./styles.css";
import { initializeTechnicaContentLibrary } from "./content/technica/library";
import { initializeAudioSystem } from "./core/audioSystem";
import { initControllerSupport } from "./core/controllerSupport";
import { initializeSettings } from "./core/settings";
import { notifyIfNewTechnicaContentLoaded, watchForGeneratedTechnicaContentChanges } from "./content/technica/notifier";
import { initEZDrag } from "./ui/ezDrag";
import { renderSplashScreen } from "./ui/screens/SplashScreen";

window.addEventListener("DOMContentLoaded", async () => {
  initializeTechnicaContentLibrary();
  watchForGeneratedTechnicaContentChanges();
  initializeAudioSystem();
  await initializeSettings();
  initControllerSupport();
  initEZDrag();
  renderSplashScreen();
  notifyIfNewTechnicaContentLoaded();
});
