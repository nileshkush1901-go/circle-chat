import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { observeState } from "../../core/state/observe-state";

import { ChatState } from "../../core/state/chat.state";
import { ActivitiesService } from "../activities/activities.service";
import { CallsService } from "../calls/calls.service";
@Component({
  selector: "app-chat-header",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./chat-header.component.html",
  styles: [":host { display: contents; }"],
})
export class ChatHeaderComponent {
  readonly state = inject(ChatState);
  readonly activities = inject(ActivitiesService);
  readonly calls = inject(CallsService);
  private readonly stateChanges = observeState();
}
