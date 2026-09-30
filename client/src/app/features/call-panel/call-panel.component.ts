import { observeState } from "../../core/state/observe-state";
import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ViewRegistryDirective } from "../../shared/directives/view-registry.directive";
import { ChatState } from "../../core/state/chat.state";
import { CallsService } from "../calls/calls.service";
@Component({
  selector: "app-call-panel",
  standalone: true,
  imports: [CommonModule, FormsModule, ViewRegistryDirective],
  templateUrl: "./call-panel.component.html",
  styles: [":host { display: contents; }"],
})
export class CallPanelComponent {
  private readonly stateChanges = observeState();
  readonly state = inject(ChatState);
  readonly calls = inject(CallsService);
}
