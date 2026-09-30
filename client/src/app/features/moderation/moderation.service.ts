import { Injectable, inject } from "@angular/core";
import { ModerationReport } from "../../shared/models/chat.models";
import { ChatState } from "../../core/state/chat.state";
import { ApiClient } from "../../core/http/api-client.service";
import { RoomsService } from "../rooms/rooms.service";
@Injectable({ providedIn: "root" })
export class ModerationService {
  private readonly state = inject(ChatState);
  private readonly apiClient = inject(ApiClient);
  private readonly rooms = inject(RoomsService);
  async report() {
    if (!this.state.reportMessage) return;
    await this.apiClient.request("/reports", "POST", {
      message: this.state.reportMessage.id,
      reason: this.state.reportReason,
    });
    this.state.modal = "";
    this.state.reportReason = "";
    this.state.notice = "Report sent to the moderation team.";
  }

  async ban(user: string) {
    await this.apiClient.request("/rooms/" + this.state.active!.id + "/ban", "POST", {
      user,
    });
    this.state.modal = "";
    await this.rooms.loadMembers();
    this.state.notice = "User removed from this room";
  }

  async admin() {
    this.state.reports = await this.apiClient.request("/admin/reports");
    this.state.view = "admin";
    this.state.mobileMenu = false;
  }

  async resolveReport(report: ModerationReport, ban = false) {
    if (ban && report.content)
      await this.apiClient.request("/admin/ban/" + report.content.user, "POST", {});
    await this.apiClient.request("/admin/reports/" + report.id, "PATCH", {});
    this.state.reports = this.state.reports.filter((x) => x.id !== report.id);
  }
}
