/** id 付き <style> を1回だけ注入する (既にあれば何もしない) */
export const ensureStyle = (id: string, css: string): void => {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
};
