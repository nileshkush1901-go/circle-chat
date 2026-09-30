import { Component, inject } from "@angular/core";
import { ThemeService } from "../../../core/theme/theme.service";

@Component({
  selector: "app-theme-toggle",
  standalone: true,
  template: `
    <button
      type="button"
      role="switch"
      class="theme-toggle"
      aria-label="Dark theme"
      [attr.aria-checked]="theme.theme() === 'dark'"
      (click)="theme.toggle()"
    >
      <span
        class="switch-track"
        [class.enabled]="theme.theme() === 'dark'"
        aria-hidden="true"
      >
        <span class="switch-thumb"></span>
      </span>
      <span>{{ theme.theme() === "dark" ? "Dark" : "Light" }}</span>
    </button>
  `,
  styles: [
    `
      .theme-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 44px;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: 9px;
        background: var(--surface);
        color: var(--text);
        white-space: nowrap;
        font-size: 0.875rem;
      }
      .theme-toggle:hover {
        background: var(--surface-muted);
      }
      .switch-track {
        display: inline-flex;
        align-items: center;
        width: 40px;
        height: 24px;
        padding: 3px;
        border-radius: 999px;
        background: #757889;
        transition: background 0.15s;
      }
      .switch-track.enabled {
        background: var(--action);
      }
      .switch-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px #0003;
        transition: transform 0.15s;
      }
      .switch-track.enabled .switch-thumb {
        transform: translateX(16px);
      }
      @media (prefers-reduced-motion: reduce) {
        .switch-track,
        .switch-thumb {
          transition: none;
        }
      }
    `,
  ],
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
