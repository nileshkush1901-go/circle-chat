import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { observeState } from "../../core/state/observe-state";
import { ViewRegistryDirective } from "../../shared/directives/view-registry.directive";
import { ChatState } from "../../core/state/chat.state";
import { MessagesService } from "../messages/messages.service";
import { ProfileService } from "../profile/profile.service";
@Component({
  selector: "app-message-list",
  standalone: true,
  imports: [CommonModule, FormsModule, ViewRegistryDirective],
  templateUrl: "./message-list.component.html",
  styles: [":host { display: contents; }"],
})
export class MessageListComponent {
  readonly state = inject(ChatState);
  readonly messages = inject(MessagesService);
  readonly profile = inject(ProfileService);
  private readonly stateChanges = observeState();
}
