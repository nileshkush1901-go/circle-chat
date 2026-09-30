import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { observeState } from "../../core/state/observe-state";

import { ChatState } from "../../core/state/chat.state";
import { MessagesService } from "../messages/messages.service";
@Component({
  selector: "app-message-composer",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./message-composer.component.html",
  styles: [":host { display: contents; }"],
})
export class MessageComposerComponent {
  readonly state = inject(ChatState);
  readonly messages = inject(MessagesService);
  private readonly stateChanges = observeState();
}
