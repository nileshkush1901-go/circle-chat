import { Injectable, inject } from "@angular/core";
import { Msg, Attachment } from "../../shared/models/chat.models";
import { ChatState } from "../../core/state/chat.state";
import { ApiClient } from "../../core/http/api-client.service";
import { RealtimeClient } from "../../core/realtime/realtime-client.service";
import { ViewRegistry } from "../../shared/directives/view-registry.directive";
@Injectable({ providedIn: "root" })
export class MessagesService {
  private readonly state = inject(ChatState);
  private readonly apiClient = inject(ApiClient);
  private readonly realtime = inject(RealtimeClient);
  private readonly views = inject(ViewRegistry);
  async send() {
    if (
      !this.state.active ||
      this.state.busy ||
      (!this.state.draft.trim() && !this.state.attachment)
    )
      return;
    this.state.busy = true;
    try {
      await this.realtime.request("message:send", {
        room: this.state.active.id,
        text: this.state.draft,
        attachment: this.state.attachment?.id,
      });
      this.state.draft = "";
      this.state.attachment = null;
      this.scroll();
    } finally {
      this.state.busy = false;
      this.state.refresh();
    }
  }

  typing() {
    if (this.state.active && Date.now() - this.state.lastTyped > 1500) {
      this.state.lastTyped = Date.now();
      this.realtime.request("typing", { room: this.state.active.id }).catch(() => {});
    }
  }

  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.state.active) return;
    if (file.size > 10 * 1024 * 1024) throw new Error("File must be under 10 MB");
    this.state.busy = true;
    try {
      const body = new FormData();
      body.append("file", file);
      const attachment = await this.apiClient.request<Attachment>(
        "/rooms/" + this.state.active.id + "/uploads",
        "POST",
        body,
      );
      this.state.attachment = attachment;
      this.state.media[attachment.id] = attachment;
    } finally {
      input.value = "";
      this.state.busy = false;
      this.state.refresh();
    }
  }

  async loadMedia(m: Msg) {
    if (m.attachment && !this.state.media[m.attachment])
      try {
        this.state.media[m.attachment] = await this.apiClient.request(
          "/uploads/" + m.attachment + "/info",
        );
      } catch {
      } finally {
        this.state.refresh();
      }
  }

  async loadOlder() {
    if (!this.state.active || !this.state.messages.length) return;
    const older = await this.apiClient.request<Msg[]>(
      "/rooms/" + this.state.active.id + "/messages?before=" + this.state.messages[0].id,
    );
    this.state.messages = [...older, ...this.state.messages];
    this.state.older = older.length === 50;
    older.forEach((m: Msg) => this.loadMedia(m));
  }

  async remove(m: Msg) {
    await this.apiClient.request("/messages/" + m.id, "DELETE");
  }

  scroll() {
    setTimeout(() => {
      const e = this.views.messageList?.nativeElement;
      if (e) e.scrollTop = e.scrollHeight;
    }, 40);
  }
}
