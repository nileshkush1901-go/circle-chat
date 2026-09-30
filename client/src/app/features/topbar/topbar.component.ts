import { ThemeToggleComponent } from "../../shared/components/theme-toggle/theme-toggle.component";
import { observeState } from "../../core/state/observe-state";
import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ChatState } from "../../core/state/chat.state";
@Component({
  selector: "app-topbar",
  standalone: true,
  imports: [ThemeToggleComponent, CommonModule, FormsModule],
  templateUrl: "./topbar.component.html",
  styles: [":host { display: contents; }"],
})
export class TopbarComponent {
  private readonly stateChanges = observeState();
  readonly state = inject(ChatState);
}
