import { Component, inject } from "@angular/core";
import { ChatState } from "../../core/state/chat.state";
import { observeState } from "../../core/state/observe-state";
import { ChatHeaderComponent } from "../chat-header/chat-header.component";
import { WhiteboardComponent } from "../whiteboard/whiteboard.component";
import { WatchPartyComponent } from "../watch-party/watch-party.component";
import { MessageListComponent } from "../message-list/message-list.component";
import { MessageComposerComponent } from "../message-composer/message-composer.component";
import { MemberListComponent } from "../member-list/member-list.component";
@Component({
  selector: "app-chat",
  standalone: true,
  imports: [
    ChatHeaderComponent,
    WhiteboardComponent,
    WatchPartyComponent,
    MessageListComponent,
    MessageComposerComponent,
    MemberListComponent,
  ],
  templateUrl: "./chat.component.html",
  styles: [":host { display: contents; }"],
})
export class ChatComponent {
  readonly state = inject(ChatState);
  private readonly stateChanges = observeState();
}
