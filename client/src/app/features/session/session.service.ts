import { Injectable, inject } from "@angular/core";

import { ChatState } from "../../core/state/chat.state";
import { ApiClient } from "../../core/http/api-client.service";
import { RealtimeClient } from "../../core/realtime/realtime-client.service";
import { EventsService } from "../events/events.service";
import { CallsService } from "../calls/calls.service";
@Injectable({ providedIn: "root" })
export class SessionService {
  private readonly state = inject(ChatState);
  private readonly apiClient = inject(ApiClient);
  private readonly realtime = inject(RealtimeClient);
  private readonly events = inject(EventsService);
  private readonly calls = inject(CallsService);
  async initialize() {
    try {
      this.state.me = await this.apiClient.request("/me");
      await this.events.start();
    } catch {
    } finally {
      this.state.loading = false;
      this.state.refresh();
    }
  }

  async authenticate() {
    if (this.state.busy) return;
    this.state.busy = true;
    this.state.error = "";
    try {
      this.state.me = await this.apiClient.request(
        "/auth/" + this.state.authMode,
        "POST",
        {
          name: this.state.nickname,
          handle: this.state.handle,
          password: this.state.password,
        },
      );
      this.state.password = "";
      await this.events.start();
    } catch (e: unknown) {
      this.state.error = e instanceof Error ? e.message : "Sign in failed";
    } finally {
      this.state.busy = false;
      this.state.refresh();
    }
  }

  async logout() {
    await this.apiClient.request("/auth/logout", "POST", {});
    this.calls.cleanCall();
    this.realtime.disconnect();
    clearTimeout(this.state.typingTimer);
    this.state.connected = false;
    this.state.waiting = false;
    this.state.typingNames = "";
    this.state.media = {};
    this.state.reports = [];
    this.state.profile = null;
    this.state.me = null;
    this.state.active = null;
    this.state.messages = [];
    this.state.view = "rooms";
    this.state.modal = "";
  }
}
