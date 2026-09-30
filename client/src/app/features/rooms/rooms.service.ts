import { Injectable, inject } from "@angular/core";
import { Room } from "../../shared/models/chat.models";
import { ChatState } from "../../core/state/chat.state";
import { ApiClient } from "../../core/http/api-client.service";
import { RealtimeClient } from "../../core/realtime/realtime-client.service";
import { MessagesService } from "../messages/messages.service";
@Injectable({ providedIn: "root" })
export class RoomsService {
  private readonly state = inject(ChatState);
  private readonly apiClient = inject(ApiClient);
  private readonly realtime = inject(RealtimeClient);
  private readonly messages = inject(MessagesService);
  async loadRooms() {
    [this.state.rooms, this.state.conversations] = await Promise.all([
      this.apiClient.request<Room[]>("/rooms"),
      this.apiClient.request<Room[]>("/conversations"),
    ]);
  }

  async loadConversations() {
    this.state.conversations = await this.apiClient.request("/conversations");
  }

  async rejoin() {
    if (!this.state.active) return;
    await this.realtime.request("room:join", { room: this.state.active.id });
    this.state.messages = await this.apiClient.request(
      "/rooms/" + this.state.active.id + "/messages",
    );
    this.state.messages.forEach((m) => this.messages.loadMedia(m));
    this.messages.scroll();
  }

  async openRoom(room: Room) {
    this.state.error = "";
    const joined = await this.realtime.request<Room>("room:join", { room: room.id });
    this.state.active = { ...room, ...joined, name: room.name, peer: room.peer };
    this.state.rooms = this.state.rooms.map((r) =>
      r.id === room.id ? { ...r, ...joined } : r,
    );
    this.state.messages = [];
    this.state.attachment = null;
    this.state.draft = "";
    this.state.online = [];
    this.state.activity = "";
    this.state.typingNames = "";
    this.state.view = "chat";
    this.state.mobileMenu = false;
    this.state.messages = await this.apiClient.request("/rooms/" + room.id + "/messages");
    this.state.older = this.state.messages.length === 50;
    this.state.messages.forEach((m) => this.messages.loadMedia(m));
    await this.loadMembers();
    this.messages.scroll();
  }

  async loadMembers() {
    if (this.state.active)
      this.state.members = await this.apiClient.request(
        "/rooms/" + this.state.active.id + "/members",
      );
  }

  async createRoom() {
    if (this.state.busy) return;
    this.state.busy = true;
    try {
      const r = await this.apiClient.request<Room>("/rooms", "POST", {
        name: this.state.roomName,
        description: this.state.roomDescription,
        category: this.state.roomCategory,
        private: this.state.roomPrivate,
      });
      this.state.rooms.push(r);
      this.state.modal = "";
      this.state.roomName = "";
      this.state.roomDescription = "";
      await this.openRoom(r);
    } finally {
      this.state.busy = false;
    }
  }

  async joinInvite() {
    const code = this.state.inviteCode.trim();
    const r = await this.apiClient.request<Room>(
      "/invites/" + encodeURIComponent(code),
      "POST",
      {},
    );
    this.state.modal = "";
    await this.loadRooms();
    await this.openRoom(r);
  }

  async direct(user: string) {
    const r = await this.apiClient.request<Room>("/conversations", "POST", { user });
    this.state.modal = "";
    await this.loadConversations();
    await this.openRoom(r);
  }

  async random() {
    this.state.modal = "random";
    this.state.waiting = true;
    try {
      await this.realtime.request("random:start");
    } catch (e) {
      this.state.waiting = false;
      throw e;
    }
  }

  async cancelRandom() {
    await this.realtime.request("random:cancel");
    this.state.waiting = false;
    this.state.modal = "";
  }
}
