import "./styles.css";
import { initializeTechnicaContentLibrary } from "./content/technica/library";
import { initEZDrag } from "./ui/ezDrag";
import { renderSplashScreen } from "./ui/screens/SplashScreen";

window.addEventListener("DOMContentLoaded", () => {
  initializeTechnicaContentLibrary();
  initEZDrag();
  renderSplashScreen();
});
