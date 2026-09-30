import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { observeState } from "../../core/state/observe-state";

import { ChatState } from "../../core/state/chat.state";
import { ActivitiesService } from "../activities/activities.service";
@Component({
  selector: "app-whiteboard",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./whiteboard.component.html",
  styles: [":host { display: contents; }"],
})
export class WhiteboardComponent {
  readonly state = inject(ChatState);
  readonly activities = inject(ActivitiesService);
  private readonly stateChanges = observeState();
}
