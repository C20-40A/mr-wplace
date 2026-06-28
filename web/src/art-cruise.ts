import "./index.css";
import { startArtCruiseWeb } from "@/inject/features/art-cruise/web";

document.documentElement.classList.add("dark");
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.background = "#000";

const asset = (path: string) =>
  `${import.meta.env.BASE_URL}assets/art-cruise/${path}`;

startArtCruiseWeb({
  audioUrls: {
    stage: asset("audio/stage.ogg"),
    boss: asset("audio/boss.ogg"),
    boss2: asset("audio/boss2.ogg"),
    gameOver: asset("audio/game-over.ogg"),
    se: {
      "player-shoot": asset("audio/se/player-shoot.wav"),
      "boss-explosion": asset("audio/se/explosion.wav"),
      "player-hit": asset("audio/se/hit-pyun.wav"),
      "player-dead": asset("audio/se/player-dead.wav"),
      "grunt-down": asset("audio/se/grunt-down.wav"),
      "enemy-shot": asset("audio/se/enemy-shot.wav"),
      "enemy-shot-short": asset("audio/se/enemy-shot-short.wav"),
    },
  },
  mandalaUrls: {
    b: asset("mandala/mandala-b.png"),
    c: asset("mandala/mandala-c.png"),
  },
  onExit: () => {
    window.location.assign(new URL("../", window.location.href));
  },
});
