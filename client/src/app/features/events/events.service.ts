import { Injectable, inject } from "@angular/core";
import {
  Person,
  Room,
  Msg,
  Stroke,
  WatchState,
  CallState,
  CallSignal,
} from "../../shared/models/chat.models";
import { ChatState } from "../../core/state/chat.state";
import { RealtimeClient } from "../../core/realtime/realtime-client.service";
import { RoomsService } from "../rooms/rooms.service";
import { MessagesService } from "../messages/messages.service";
import { ActivitiesService } from "../activities/activities.service";
import { CallsService } from "../calls/calls.service";
@Injectable({ providedIn: "root" })
export class EventsService {
  private readonly state = inject(ChatState);
  private readonly realtime = inject(RealtimeClient);
  private readonly rooms = inject(RoomsService);
  private readonly messages = inject(MessagesService);
  private readonly activities = inject(ActivitiesService);
  private readonly calls = inject(CallsService);
  async start() {
    await this.rooms.loadRooms();
    this.realtime.connect();
    this.realtime.socket.on("connect", () => {
      this.state.connected = true;
      if (this.state.active) this.state.run(this.rooms.rejoin());
      this.state.refresh();
    });
    this.realtime.socket.on("disconnect", () => {
      this.state.connected = false;
      this.state.refresh();
    });
    this.realtime.socket.on("connect_error", (e) => {
      this.state.error = e.message;
      this.state.refresh();
    });
    this.realtime.socket.on("message", (m: Msg) => {
      if (this.state.me?.blocked?.includes(m.user)) return;
      if (this.state.active?.id === m.room) {
        if (!this.state.messages.some((x) => x.id === m.id)) {
          this.state.messages.push(m);
          this.messages.loadMedia(m);
          this.messages.scroll();
        }
      } else {
        this.state.notice = `New message from ${m.name}`;
        this.state.run(this.rooms.loadConversations());
      }
      this.state.refresh();
    });
    this.realtime.socket.on("message:updated", (m: Msg) => {
      this.state.messages = this.state.messages.map((x) => (x.id === m.id ? m : x));
      this.state.refresh();
    });
    this.realtime.socket.on("presence", (p: { room: string; users: Person[] }) => {
      if (p.room === this.state.active?.id) {
        this.state.online = p.users;
        this.state.run(this.rooms.loadMembers());
      }
      this.state.rooms = this.state.rooms.map((r) =>
        r.id === p.room ? { ...r, online: p.users.length } : r,
      );
      this.state.refresh();
    });
    this.realtime.socket.on(
      "typing",
      (p: { room: string; user: string; name: string }) => {
        if (p.room !== this.state.active?.id || this.state.me?.blocked?.includes(p.user))
          return;
        this.state.typingNames = p.name + " is typing…";
        clearTimeout(this.state.typingTimer);
        this.state.typingTimer = setTimeout(() => {
          this.state.typingNames = "";
          this.state.refresh();
        }, 2200);
        this.state.refresh();
      },
    );
    this.realtime.socket.on("random:matched", (r: Room) => {
      this.state.waiting = false;
      this.state.modal = "";
      this.state.run(this.rooms.openRoom(r));
      this.state.run(this.rooms.loadConversations());
      this.state.refresh();
    });
    this.realtime.socket.on("room:removed", (p: { room: string }) => {
      if (this.state.active?.id === p.room) {
        this.state.active = null;
        this.state.messages = [];
        this.state.view = "rooms";
        this.state.error = "You were removed from this room";
      }
      this.state.run(this.rooms.loadRooms());
      this.state.refresh();
    });
    this.realtime.socket.on("board:stroke", (p: { room: string; stroke: Stroke }) => {
      if (p.room === this.state.active?.id)
        this.state.board = [...this.state.board, p.stroke].slice(-500);
      this.state.refresh();
    });
    this.realtime.socket.on("board:clear", (p: { room: string }) => {
      if (p.room === this.state.active?.id) this.state.board = [];
      this.state.refresh();
    });
    this.realtime.socket.on("watch:update", (p: { room: string; watch: WatchState }) => {
      if (p.room === this.state.active?.id) {
        this.state.watch = p.watch;
        this.activities.syncWatch();
      }
      this.state.refresh();
    });
    this.realtime.socket.on("call:incoming", (p: Omit<CallState, "incoming">) => {
      this.state.call = { ...p, incoming: true };
      this.state.callStatus = "Incoming " + (p.video ? "video" : "voice") + " call";
      this.state.refresh();
    });
    this.realtime.socket.on("call:accepted", () =>
      this.state.run(this.calls.makeOffer()),
    );
    this.realtime.socket.on("call:signal", (p: { signal: CallSignal }) =>
      this.state.run(this.calls.signal(p.signal)),
    );
    this.realtime.socket.on("call:ended", () => this.calls.cleanCall());
  }
}
