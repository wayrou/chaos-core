import "./styles.css";
import { initEZDrag } from "./ui/ezDrag";
import { renderSplashScreen } from "./ui/screens/SplashScreen";

window.addEventListener("DOMContentLoaded", () => {
  initEZDrag();
  renderSplashScreen();
});
