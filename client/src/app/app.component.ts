import { observeState } from "./core/state/observe-state";
import { Component, OnInit, OnDestroy, inject } from "@angular/core";
import { ChatState } from "./core/state/chat.state";
import { SessionService } from "./features/session/session.service";
import { CallsService } from "./features/calls/calls.service";
import { RealtimeClient } from "./core/realtime/realtime-client.service";
import { AuthComponent } from "./features/auth/auth.component";
import { SidebarComponent } from "./features/sidebar/sidebar.component";
import { TopbarComponent } from "./features/topbar/topbar.component";
import { RoomDirectoryComponent } from "./features/room-directory/room-directory.component";
import { InboxComponent } from "./features/inbox/inbox.component";
import { AdminComponent } from "./features/admin/admin.component";
import { ChatComponent } from "./features/chat/chat.component";
import { DialogsComponent } from "./features/dialogs/dialogs.component";
import { CallPanelComponent } from "./features/call-panel/call-panel.component";
@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    AuthComponent,
    SidebarComponent,
    TopbarComponent,
    RoomDirectoryComponent,
    InboxComponent,
    AdminComponent,
    ChatComponent,
    DialogsComponent,
    CallPanelComponent,
  ],
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly stateChanges = observeState();
  readonly state = inject(ChatState);
  private readonly session = inject(SessionService);
  private readonly calls = inject(CallsService);
  private readonly realtime = inject(RealtimeClient);
  ngOnInit() {
    void this.session.initialize();
  }
  ngOnDestroy() {
    clearTimeout(this.state.typingTimer);
    this.calls.cleanCall();
    this.realtime.disconnect();
  }
}
