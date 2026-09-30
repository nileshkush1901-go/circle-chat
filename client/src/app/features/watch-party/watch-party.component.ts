import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { observeState } from "../../core/state/observe-state";
import { ViewRegistryDirective } from "../../shared/directives/view-registry.directive";
import { ChatState } from "../../core/state/chat.state";
import { ActivitiesService } from "../activities/activities.service";
@Component({
  selector: "app-watch-party",
  standalone: true,
  imports: [CommonModule, FormsModule, ViewRegistryDirective],
  templateUrl: "./watch-party.component.html",
  styles: [":host { display: contents; }"],
})
export class WatchPartyComponent {
  readonly state = inject(ChatState);
  readonly activities = inject(ActivitiesService);
  private readonly stateChanges = observeState();
}
