import { Injectable, inject } from "@angular/core";

import { ChatState } from "../../core/state/chat.state";
import { ApiClient } from "../../core/http/api-client.service";
import { RoomsService } from "../rooms/rooms.service";
@Injectable({ providedIn: "root" })
export class ProfileService {
  private readonly state = inject(ChatState);
  private readonly apiClient = inject(ApiClient);
  private readonly rooms = inject(RoomsService);
  async showProfile(user: string) {
    this.state.profile = await this.apiClient.request("/users/" + user);
    this.state.modal = "profile";
  }

  async block(user: string) {
    await this.apiClient.request("/block/" + user, "POST", {});
    this.state.me!.blocked = [...(this.state.me!.blocked || []), user];
    this.state.messages = this.state.messages.filter((m) => m.user !== user);
    if (this.state.active?.kind === "dm" && this.state.active.peer?.id === user) {
      this.state.active = null;
      this.state.view = "rooms";
    }
    await this.rooms.loadConversations();
    this.state.modal = "";
    this.state.notice = "User blocked. Manage blocked users in your profile.";
  }

  async unblock(user: string) {
    await this.apiClient.request("/block/" + user, "DELETE");
    this.state.me!.blocked = this.state.me!.blocked?.filter((x) => x !== user);
    this.state.blocked = this.state.blocked.filter((x) => x.id !== user);
    await this.rooms.loadConversations();
  }

  async settings() {
    this.state.editName = this.state.me!.name;
    this.state.editBio = this.state.me!.bio;
    this.state.editColor = this.state.me!.color;
    this.state.blocked = await this.apiClient.request("/blocked");
    this.state.modal = "settings";
  }

  async saveProfile() {
    this.state.me = await this.apiClient.request("/me", "PATCH", {
      name: this.state.editName,
      bio: this.state.editBio,
      color: this.state.editColor,
    });
    this.state.modal = "";
    this.state.notice = "Profile updated";
  }
}
