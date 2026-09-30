import { Injectable, signal } from "@angular/core";
import {
  Person,
  Room,
  Msg,
  Stroke,
  Attachment,
  WatchState,
  CallState,
  ModerationReport,
} from "../../shared/models/chat.models";
@Injectable({ providedIn: "root" })
export class ChatState {
  readonly revision = signal(0);
  refresh() {
    this.revision.update((value) => value + 1);
  }
  me: Person | null = null;
  loading = true;
  busy = false;
  error = "";
  notice = "";
  authMode = "guest";
  nickname = "";
  handle = "";
  password = "";
  rooms: Room[] = [];
  conversations: Room[] = [];
  active: Room | null = null;
  messages: Msg[] = [];
  members: Person[] = [];
  online: Person[] = [];
  view = "rooms";
  search = "";
  category = "All";
  categories = ["All", "General", "Music", "Gaming", "Learning", "Movies", "Travel"];
  draft = "";
  attachment: Attachment | null = null;
  media: Record<string, Attachment> = {};
  connected = false;
  typingNames = "";
  typingTimer?: ReturnType<typeof setTimeout>;
  lastTyped = 0;
  modal = "";
  roomName = "";
  roomDescription = "";
  roomCategory = "General";
  roomPrivate = false;
  inviteCode = "";
  profile: Person | null = null;
  editName = "";
  editBio = "";
  editColor = "#6750e8";
  blocked: Person[] = [];
  reportMessage: Msg | null = null;
  reportReason = "";
  reports: ModerationReport[] = [];
  waiting = false;
  activity = "";
  board: Stroke[] = [];
  currentStroke: Stroke | null = null;
  ink = "#6750e8";
  watch: WatchState | null = null;
  watchFile = "";
  mobileMenu = false;
  older = true;
  call: CallState | null = null;
  muted = false;
  videoOff = false;
  callStatus = "";
  async run(task: Promise<unknown>) {
    try {
      await task;
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : "Something went wrong";
    } finally {
      this.refresh();
    }
  }
  get filteredRooms() {
    return this.rooms.filter(
      (r) =>
        (this.category === "All" || r.category === this.category) &&
        (r.name + " " + r.description).toLowerCase().includes(this.search.toLowerCase()),
    );
  }
  icon(category: string) {
    return (
      (
        {
          General: "☕",
          Music: "♫",
          Gaming: "⌘",
          Learning: "文",
          Movies: "▣",
          Travel: "✈",
        } as Record<string, string>
      )[category] || "#"
    );
  }
  initials(name: string) {
    return name
      .split(" ")
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  get isModerator() {
    return this.me?.role === "admin" || this.active?.owner === this.me?.id;
  }
  get videos() {
    return this.messages.filter(
      (m) => m.attachment && this.media[m.attachment]?.mime?.startsWith("video/"),
    );
  }
}
