import { Injectable, signal, DestroyRef, inject } from "@angular/core";
export type Theme = "light" | "dark";
const STORAGE_KEY = "circle.theme";
@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly selected = signal<Theme>(
    document.documentElement.dataset["theme"] === "dark" ? "dark" : "light",
  );
  readonly theme = this.selected.asReadonly();
  constructor() {
    const sync = (event: StorageEvent) => {
      if (
        event.key === STORAGE_KEY &&
        (event.newValue === "light" || event.newValue === "dark")
      )
        this.apply(event.newValue);
    };
    window.addEventListener("storage", sync);
    inject(DestroyRef).onDestroy(() => window.removeEventListener("storage", sync));
  }
  toggle() {
    const theme = this.theme() === "dark" ? "light" : "dark";
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Theme still works when storage is unavailable. */
    }
  }
  private apply(theme: Theme) {
    document.documentElement.dataset["theme"] = theme;
    this.selected.set(theme);
  }
}
