import { ThemeToggleComponent } from "../../shared/components/theme-toggle/theme-toggle.component";
import { observeState } from "../../core/state/observe-state";
import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ChatState } from "../../core/state/chat.state";
import { SessionService } from "../session/session.service";
@Component({
  selector: "app-auth",
  standalone: true,
  imports: [ThemeToggleComponent, CommonModule, FormsModule],
  templateUrl: "./auth.component.html",
  styles: [":host { display: contents; }"],
})
export class AuthComponent {
  private readonly stateChanges = observeState();
  readonly state = inject(ChatState);
  readonly session = inject(SessionService);
}
