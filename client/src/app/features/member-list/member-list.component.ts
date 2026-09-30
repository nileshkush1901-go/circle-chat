import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { observeState } from "../../core/state/observe-state";

import { ChatState } from "../../core/state/chat.state";
import { ProfileService } from "../profile/profile.service";
@Component({
  selector: "app-member-list",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./member-list.component.html",
  styles: [":host { display: contents; }"],
})
export class MemberListComponent {
  readonly state = inject(ChatState);
  readonly profile = inject(ProfileService);
  private readonly stateChanges = observeState();
}
