export const FONT_STACK =
  '"misaki gothic", "Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

export const formatScore = (score: number) =>
  Math.max(0, Math.floor(score)).toString().padStart(8, "0");

/** カンマ区切り表示（例: 40,250）。ゲームオーバー画面など見せ場用 */
export const formatScoreComma = (score: number) =>
  Math.max(0, Math.floor(score)).toLocaleString("en-US");

export const formatTime = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const formatHp = (hp: number) => "♥".repeat(Math.max(0, hp)) || "";
