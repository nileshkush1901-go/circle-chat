import { observeState } from "../../core/state/observe-state";
import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ChatState } from "../../core/state/chat.state";
import { RoomsService } from "../rooms/rooms.service";
import { ModerationService } from "../moderation/moderation.service";
import { ProfileService } from "../profile/profile.service";
@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./sidebar.component.html",
  styles: [":host { display: contents; }"],
})
export class SidebarComponent {
  private readonly stateChanges = observeState();
  readonly state = inject(ChatState);
  readonly rooms = inject(RoomsService);
  readonly moderation = inject(ModerationService);
  readonly profile = inject(ProfileService);
}
