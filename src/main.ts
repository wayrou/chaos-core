import "./styles.css";
import { initializeTechnicaContentLibrary } from "./content/technica/library";
import { initializeAudioSystem } from "./core/audioSystem";
import { initControllerSupport } from "./core/controllerSupport";
import { initializeSettings } from "./core/settings";
import { notifyIfNewTechnicaContentLoaded, watchForGeneratedTechnicaContentChanges } from "./content/technica/notifier";
import { initEZDrag } from "./ui/ezDrag";
import { initializeAppUpdater } from "./ui/appUpdater";
import { installNativeDialogOverrides } from "./ui/components/confirmDialog";
import { renderSplashScreen } from "./ui/screens/SplashScreen";

window.addEventListener("DOMContentLoaded", async () => {
  initializeTechnicaContentLibrary();
  watchForGeneratedTechnicaContentChanges();
  initializeAudioSystem();
  await initializeSettings();
  initControllerSupport();
  installNativeDialogOverrides();
  initEZDrag();
  renderSplashScreen();
  void initializeAppUpdater();
  notifyIfNewTechnicaContentLoaded();
});
