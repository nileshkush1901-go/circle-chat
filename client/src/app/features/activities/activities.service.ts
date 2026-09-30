import { Injectable, inject } from "@angular/core";
import { Stroke, WatchState } from "../../shared/models/chat.models";
import { ChatState } from "../../core/state/chat.state";
import { ApiClient } from "../../core/http/api-client.service";
import { RealtimeClient } from "../../core/realtime/realtime-client.service";
import { ViewRegistry } from "../../shared/directives/view-registry.directive";
@Injectable({ providedIn: "root" })
export class ActivitiesService {
  private readonly state = inject(ChatState);
  private readonly apiClient = inject(ApiClient);
  private readonly realtime = inject(RealtimeClient);
  private readonly views = inject(ViewRegistry);
  async openActivity(type: string) {
    if (!this.state.active) return;
    const data = await this.apiClient.request<{
      board: Stroke[];
      watch: WatchState | null;
    }>("/rooms/" + this.state.active.id + "/activity");
    this.state.board = data.board || [];
    this.state.watch = data.watch;
    this.state.activity = this.state.activity === type ? "" : type;
    if (type === "watch") this.syncWatch();
  }

  point(event: PointerEvent) {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    ];
  }

  beginStroke(event: PointerEvent) {
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.state.currentStroke = { color: this.state.ink, points: [this.point(event)] };
  }

  moveStroke(event: PointerEvent) {
    if (this.state.currentStroke && this.state.currentStroke.points.length < 500)
      this.state.currentStroke.points.push(this.point(event));
  }

  async endStroke() {
    const stroke = this.state.currentStroke;
    this.state.currentStroke = null;
    if (stroke && stroke.points.length > 1)
      await this.realtime.request("board:stroke", {
        room: this.state.active!.id,
        ...stroke,
      });
  }

  points(stroke: Stroke) {
    return stroke.points.map((p) => `${p[0] * 800},${p[1] * 450}`).join(" ");
  }

  async clearBoard() {
    await this.realtime.request("board:clear", { room: this.state.active!.id });
  }

  async watchControl(playing: boolean) {
    const video = this.views.watchVideo?.nativeElement;
    const attachment = this.state.watchFile || this.state.watch?.attachment;
    if (!attachment)
      throw new Error("Upload a video to the chat first, then choose it here.");
    await this.realtime.request("watch:update", {
      room: this.state.active!.id,
      attachment,
      playing,
      time: attachment === this.state.watch?.attachment ? video?.currentTime || 0 : 0,
    });
    this.state.watchFile = "";
  }

  syncWatch() {
    setTimeout(() => {
      const video = this.views.watchVideo?.nativeElement;
      if (!video || !this.state.watch) return;
      const desired =
        this.state.watch.time +
        (this.state.watch.playing ? (Date.now() - this.state.watch.at) / 1000 : 0);
      if (Number.isFinite(desired)) video.currentTime = desired;
      if (this.state.watch.playing)
        video.play().catch(() => {
          this.state.notice = "Press Play together to enable video playback";
          this.state.refresh();
        });
      else video.pause();
    }, 80);
  }
}
