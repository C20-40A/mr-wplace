import "./index.css";
import { startArtCruiseWeb } from "@/inject/features/art-cruise/web";

document.documentElement.classList.add("dark");
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.background = "#000";

startArtCruiseWeb({
  onExit: () => {
    window.location.assign(new URL("../", window.location.href));
  },
});
