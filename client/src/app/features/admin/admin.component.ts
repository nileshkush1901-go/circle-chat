import { observeState } from "../../core/state/observe-state";
import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ChatState } from "../../core/state/chat.state";
import { ModerationService } from "../moderation/moderation.service";
@Component({
  selector: "app-admin",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./admin.component.html",
  styles: [":host { display: contents; }"],
})
export class AdminComponent {
  private readonly stateChanges = observeState();
  readonly state = inject(ChatState);
  readonly moderation = inject(ModerationService);
}
