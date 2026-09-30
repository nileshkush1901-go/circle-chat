import { observeState } from "../../core/state/observe-state";
import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ChatState } from "../../core/state/chat.state";
import { RoomsService } from "../rooms/rooms.service";
@Component({
  selector: "app-room-directory",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./room-directory.component.html",
  styles: [":host { display: contents; }"],
})
export class RoomDirectoryComponent {
  private readonly stateChanges = observeState();
  readonly state = inject(ChatState);
  readonly rooms = inject(RoomsService);
}
