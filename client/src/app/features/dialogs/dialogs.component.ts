import { observeState } from "../../core/state/observe-state";
import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ChatState } from "../../core/state/chat.state";
import { RoomsService } from "../rooms/rooms.service";
import { ProfileService } from "../profile/profile.service";
import { ModerationService } from "../moderation/moderation.service";
import { SessionService } from "../session/session.service";
@Component({
  selector: "app-dialogs",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./dialogs.component.html",
  styles: [":host { display: contents; }"],
})
export class DialogsComponent {
  private readonly stateChanges = observeState();
  readonly state = inject(ChatState);
  readonly rooms = inject(RoomsService);
  readonly profile = inject(ProfileService);
  readonly moderation = inject(ModerationService);
  readonly session = inject(SessionService);
}
