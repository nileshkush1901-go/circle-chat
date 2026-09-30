// Runs before styles and Angular; external file keeps the strict script CSP intact.
(() => {
  let saved;
  try {
    saved = localStorage.getItem("circle.theme");
  } catch {}
  const theme =
    saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
})();
