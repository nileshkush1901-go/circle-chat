import {
  Component,
  ChangeDetectorRef,
  OnInit,
  ViewChild,
  ElementRef,
  provideZonelessChangeDetection,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { io, Socket } from "socket.io-client";
interface Person {
  id: string;
  name: string;
  color: string;
  bio: string;
  guest: boolean;
  role: string;
  blocked?: string[];
  online?: boolean;
}
interface Room {
  id: string;
  name: string;
  description: string;
  category: string;
  private: boolean;
  kind: string;
  owner: string;
  members: string[];
  invite?: string;
  peer?: Person;
  online?: number;
}
interface Msg {
  id: string;
  room: string;
  user: string;
  name: string;
  color: string;
  text: string;
  attachment?: string;
  createdAt: string;
  deleted: boolean;
}
interface Stroke {
  color: string;
  points: number[][];
}
@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.html",
})
export class App implements OnInit {
  @ViewChild("messageList") messageList?: ElementRef<HTMLElement>;
  @ViewChild("localVideo") localVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild("remoteVideo") remoteVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild("watchVideo") watchVideo?: ElementRef<HTMLVideoElement>;
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
  socket?: Socket;
  view = "rooms";
  search = "";
  category = "All";
  categories = [
    "All",
    "General",
    "Music",
    "Gaming",
    "Learning",
    "Movies",
    "Travel",
  ];
  draft = "";
  attachment: any = null;
  media: Record<string, any> = {};
  connected = false;
  typingNames = "";
  typingTimer: any;
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
  reports: any[] = [];
  waiting = false;
  activity = "";
  board: Stroke[] = [];
  currentStroke: Stroke | null = null;
  ink = "#6750e8";
  watch: any = null;
  watchFile = "";
  mobileMenu = false;
  older = true;
  call: any = null;
  pc?: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  pendingCandidates: RTCIceCandidateInit[] = [];
  muted = false;
  videoOff = false;
  callStatus = "";
  constructor(private cd: ChangeDetectorRef) {}
  refresh() {
    requestAnimationFrame(() => this.cd.markForCheck());
  }
  async run(task: Promise<any>) {
    try {
      await task;
    } catch (e: any) {
      this.error = e.message || "Something went wrong";
    } finally {
      this.refresh();
    }
  }
  async api(url: string, method = "GET", body?: any) {
    try {
      const response = await fetch("/api" + url, {
        method,
        credentials: "include",
        headers:
          body instanceof FormData
            ? { "X-Circle-Request": "1" }
            : { "Content-Type": "application/json", "X-Circle-Request": "1" },
        body: body
          ? body instanceof FormData
            ? body
            : JSON.stringify(body)
          : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    } finally {
      this.refresh();
    }
  }
  async ngOnInit() {
    try {
      this.me = await this.api("/me");
      await this.start();
    } catch {
    } finally {
      this.loading = false;
      this.refresh();
    }
  }
  async authenticate() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    try {
      this.me = await this.api("/auth/" + this.authMode, "POST", {
        name: this.nickname,
        handle: this.handle,
        password: this.password,
      });
      this.password = "";
      await this.start();
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.busy = false;
      this.refresh();
    }
  }
  async start() {
    await this.loadRooms();
    this.socket?.disconnect();
    this.socket = io({ withCredentials: true });
    this.socket.on("connect", () => {
      this.connected = true;
      if (this.active) this.run(this.rejoin());
      this.refresh();
    });
    this.socket.on("disconnect", () => {
      this.connected = false;
      this.refresh();
    });
    this.socket.on("connect_error", (e) => {
      this.error = e.message;
      this.refresh();
    });
    this.socket.on("message", (m: Msg) => {
      if (this.me?.blocked?.includes(m.user)) return;
      if (this.active?.id === m.room) {
        if (!this.messages.some((x) => x.id === m.id)) {
          this.messages.push(m);
          this.loadMedia(m);
          this.scroll();
        }
      } else {
        this.notice = `New message from ${m.name}`;
        this.run(this.loadConversations());
      }
      this.refresh();
    });
    this.socket.on("message:updated", (m: Msg) => {
      this.messages = this.messages.map((x) => (x.id === m.id ? m : x));
      this.refresh();
    });
    this.socket.on("presence", (p: any) => {
      if (p.room === this.active?.id) {
        this.online = p.users;
        this.run(this.loadMembers());
      }
      this.rooms = this.rooms.map((r) =>
        r.id === p.room ? { ...r, online: p.users.length } : r,
      );
      this.refresh();
    });
    this.socket.on("typing", (p: any) => {
      if (p.room !== this.active?.id || this.me?.blocked?.includes(p.user))
        return;
      this.typingNames = p.name + " is typing…";
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => {
        this.typingNames = "";
        this.refresh();
      }, 2200);
      this.refresh();
    });
    this.socket.on("random:matched", (r: Room) => {
      this.waiting = false;
      this.modal = "";
      this.run(this.openRoom(r));
      this.run(this.loadConversations());
      this.refresh();
    });
    this.socket.on("room:removed", (p: any) => {
      if (this.active?.id === p.room) {
        this.active = null;
        this.messages = [];
        this.view = "rooms";
        this.error = "You were removed from this room";
      }
      this.run(this.loadRooms());
      this.refresh();
    });
    this.socket.on("board:stroke", (p: any) => {
      if (p.room === this.active?.id)
        this.board = [...this.board, p.stroke].slice(-500);
      this.refresh();
    });
    this.socket.on("board:clear", (p: any) => {
      if (p.room === this.active?.id) this.board = [];
      this.refresh();
    });
    this.socket.on("watch:update", (p: any) => {
      if (p.room === this.active?.id) {
        this.watch = p.watch;
        this.syncWatch();
      }
      this.refresh();
    });
    this.socket.on("call:incoming", (p: any) => {
      this.call = { ...p, incoming: true };
      this.callStatus = "Incoming " + (p.video ? "video" : "voice") + " call";
      this.refresh();
    });
    this.socket.on("call:accepted", () => this.run(this.makeOffer()));
    this.socket.on("call:signal", (p: any) => this.run(this.signal(p.signal)));
    this.socket.on("call:ended", () => this.cleanCall());
  }
  async loadRooms() {
    [this.rooms, this.conversations] = await Promise.all([
      this.api("/rooms"),
      this.api("/conversations"),
    ]);
  }
  async loadConversations() {
    this.conversations = await this.api("/conversations");
  }
  emit(event: string, data: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected)
        return reject(
          new Error("Connection lost. Please wait for reconnection."),
        );
      this.socket.timeout(10000).emit(event, data, (err: any, result: any) => {
        this.refresh();
        if (err)
          return reject(
            new Error(
              "Request timed out. Check the conversation before retrying.",
            ),
          );
        if (!result?.ok)
          return reject(new Error(result?.error || "Action failed"));
        resolve(result.data);
      });
    });
  }
  async rejoin() {
    if (!this.active) return;
    await this.emit("room:join", { room: this.active.id });
    this.messages = await this.api("/rooms/" + this.active.id + "/messages");
    this.messages.forEach((m) => this.loadMedia(m));
    this.scroll();
  }
  async openRoom(room: Room) {
    this.error = "";
    const joined = await this.emit("room:join", { room: room.id });
    this.active = { ...room, ...joined, name: room.name, peer: room.peer };
    this.rooms = this.rooms.map((r) => r.id === room.id ? { ...r, ...joined } : r);
    this.messages = [];
    this.attachment = null;
    this.draft = "";
    this.online = [];
    this.activity = "";
    this.typingNames = "";
    this.view = "chat";
    this.mobileMenu = false;
    this.messages = await this.api("/rooms/" + room.id + "/messages");
    this.older = this.messages.length === 50;
    this.messages.forEach((m) => this.loadMedia(m));
    await this.loadMembers();
    this.scroll();
  }
  async loadMembers() {
    if (this.active)
      this.members = await this.api("/rooms/" + this.active.id + "/members");
  }
  get filteredRooms() {
    return this.rooms.filter(
      (r) =>
        (this.category === "All" || r.category === this.category) &&
        (r.name + " " + r.description)
          .toLowerCase()
          .includes(this.search.toLowerCase()),
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
  scroll() {
    setTimeout(() => {
      const e = this.messageList?.nativeElement;
      if (e) e.scrollTop = e.scrollHeight;
    }, 40);
  }
  async send() {
    if (!this.active || this.busy || (!this.draft.trim() && !this.attachment))
      return;
    this.busy = true;
    try {
      await this.emit("message:send", {
        room: this.active.id,
        text: this.draft,
        attachment: this.attachment?.id,
      });
      this.draft = "";
      this.attachment = null;
      this.scroll();
    } finally {
      this.busy = false;
      this.refresh();
    }
  }
  typing() {
    if (this.active && Date.now() - this.lastTyped > 1500) {
      this.lastTyped = Date.now();
      this.emit("typing", { room: this.active.id }).catch(() => {});
    }
  }
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.active) return;
    if (file.size > 10 * 1024 * 1024)
      throw new Error("File must be under 10 MB");
    this.busy = true;
    try {
      const body = new FormData();
      body.append("file", file);
      this.attachment = await this.api(
        "/rooms/" + this.active.id + "/uploads",
        "POST",
        body,
      );
      this.media[this.attachment.id] = this.attachment;
    } finally {
      input.value = "";
      this.busy = false;
      this.refresh();
    }
  }
  async loadMedia(m: Msg) {
    if (m.attachment && !this.media[m.attachment])
      try {
        this.media[m.attachment] = await this.api(
          "/uploads/" + m.attachment + "/info",
        );
      } catch {}
  }
  async loadOlder() {
    if (!this.active || !this.messages.length) return;
    const older = await this.api(
      "/rooms/" + this.active.id + "/messages?before=" + this.messages[0].id,
    );
    this.messages = [...older, ...this.messages];
    this.older = older.length === 50;
    older.forEach((m: Msg) => this.loadMedia(m));
  }
  async createRoom() {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await this.api("/rooms", "POST", {
        name: this.roomName,
        description: this.roomDescription,
        category: this.roomCategory,
        private: this.roomPrivate,
      });
      this.rooms.push(r);
      this.modal = "";
      this.roomName = "";
      this.roomDescription = "";
      await this.openRoom(r);
    } finally {
      this.busy = false;
    }
  }
  async joinInvite() {
    const code = this.inviteCode.trim();
    const r = await this.api(
      "/invites/" + encodeURIComponent(code),
      "POST",
      {},
    );
    this.modal = "";
    await this.loadRooms();
    await this.openRoom(r);
  }
  async showProfile(user: string) {
    this.profile = await this.api("/users/" + user);
    this.modal = "profile";
  }
  async direct(user: string) {
    const r = await this.api("/conversations", "POST", { user });
    this.modal = "";
    await this.loadConversations();
    await this.openRoom(r);
  }
  async block(user: string) {
    await this.api("/block/" + user, "POST", {});
    this.me!.blocked = [...(this.me!.blocked || []), user];
    this.messages = this.messages.filter((m) => m.user !== user);
    if (this.active?.kind === "dm" && this.active.peer?.id === user) {
      this.active = null;
      this.view = "rooms";
    }
    await this.loadConversations();
    this.modal = "";
    this.notice = "User blocked. Manage blocked users in your profile.";
  }
  async unblock(user: string) {
    await this.api("/block/" + user, "DELETE");
    this.me!.blocked = this.me!.blocked?.filter((x) => x !== user);
    this.blocked = this.blocked.filter((x) => x.id !== user);
    await this.loadConversations();
  }
  async settings() {
    this.editName = this.me!.name;
    this.editBio = this.me!.bio;
    this.editColor = this.me!.color;
    this.blocked = await this.api("/blocked");
    this.modal = "settings";
  }
  async saveProfile() {
    this.me = await this.api("/me", "PATCH", {
      name: this.editName,
      bio: this.editBio,
      color: this.editColor,
    });
    this.modal = "";
    this.notice = "Profile updated";
  }
  async logout() {
    await this.api("/auth/logout", "POST", {});
    this.cleanCall();
    this.socket?.disconnect();
    this.me = null;
    this.active = null;
    this.messages = [];
    this.view = "rooms";
    this.modal = "";
  }
  async random() {
    this.modal = "random";
    this.waiting = true;
    try {
      await this.emit("random:start");
    } catch (e) {
      this.waiting = false;
      throw e;
    }
  }
  async cancelRandom() {
    await this.emit("random:cancel");
    this.waiting = false;
    this.modal = "";
  }
  async report() {
    if (!this.reportMessage) return;
    await this.api("/reports", "POST", {
      message: this.reportMessage.id,
      reason: this.reportReason,
    });
    this.modal = "";
    this.reportReason = "";
    this.notice = "Report sent to the moderation team.";
  }
  async remove(m: Msg) {
    await this.api("/messages/" + m.id, "DELETE");
  }
  async ban(user: string) {
    await this.api("/rooms/" + this.active!.id + "/ban", "POST", { user });
    this.modal = "";
    await this.loadMembers();
    this.notice = "User removed from this room";
  }
  get isModerator() {
    return this.me?.role === "admin" || this.active?.owner === this.me?.id;
  }
  async admin() {
    this.reports = await this.api("/admin/reports");
    this.view = "admin";
    this.mobileMenu = false;
  }
  async resolveReport(report: any, ban = false) {
    if (ban && report.content)
      await this.api("/admin/ban/" + report.content.user, "POST", {});
    await this.api("/admin/reports/" + report.id, "PATCH", {});
    this.reports = this.reports.filter((x) => x.id !== report.id);
  }
  async openActivity(type: string) {
    if (!this.active) return;
    const data = await this.api("/rooms/" + this.active.id + "/activity");
    this.board = data.board || [];
    this.watch = data.watch;
    this.activity = this.activity === type ? "" : type;
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
    this.currentStroke = { color: this.ink, points: [this.point(event)] };
  }
  moveStroke(event: PointerEvent) {
    if (this.currentStroke && this.currentStroke.points.length < 500)
      this.currentStroke.points.push(this.point(event));
  }
  async endStroke() {
    const stroke = this.currentStroke;
    this.currentStroke = null;
    if (stroke && stroke.points.length > 1)
      await this.emit("board:stroke", { room: this.active!.id, ...stroke });
  }
  points(stroke: Stroke) {
    return stroke.points.map((p) => `${p[0] * 800},${p[1] * 450}`).join(" ");
  }
  async clearBoard() {
    await this.emit("board:clear", { room: this.active!.id });
  }
  get videos() {
    return this.messages.filter(
      (m) =>
        m.attachment && this.media[m.attachment]?.mime?.startsWith("video/"),
    );
  }
  async watchControl(playing: boolean) {
    const video = this.watchVideo?.nativeElement;
    const attachment = this.watchFile || this.watch?.attachment;
    if (!attachment)
      throw new Error("Upload a video to the chat first, then choose it here.");
    await this.emit("watch:update", {
      room: this.active!.id,
      attachment,
      playing,
      time: attachment === this.watch?.attachment ? video?.currentTime || 0 : 0,
    });
    this.watchFile = "";
  }
  syncWatch() {
    setTimeout(() => {
      const video = this.watchVideo?.nativeElement;
      if (!video || !this.watch) return;
      const desired =
        this.watch.time +
        (this.watch.playing ? (Date.now() - this.watch.at) / 1000 : 0);
      if (Number.isFinite(desired)) video.currentTime = desired;
      if (this.watch.playing)
        video.play().catch(() => {
          this.notice = "Press Play together to enable video playback";
          this.refresh();
        });
      else video.pause();
    }, 80);
  }
  async callPeer(video: boolean) {
    if (this.call) throw new Error("End your current call first.");
    if (!this.active?.peer) return;
    this.call = {
      room: this.active.id,
      video,
      from: this.active.peer,
      incoming: false,
    };
    this.callStatus = "Calling " + this.active.peer.name + "…";
    try {
      await this.prepareMedia(video);
      await this.emit("call:invite", { room: this.active.id, video });
    } catch (e) {
      this.cleanCall();
      throw e;
    }
  }
  async prepareMedia(video: boolean) {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video,
    });
    const config = await this.api("/rtc-config");
    this.pc = new RTCPeerConnection(config);
    this.pendingCandidates = [];
    for (const track of this.localStream.getTracks())
      this.pc.addTrack(track, this.localStream);
    this.pc.onicecandidate = (e) => {
      if (e.candidate)
        this.emit("call:signal", {
          signal: { candidate: e.candidate.toJSON() },
        }).catch(() => {});
    };
    this.pc.ontrack = (e) => {
      this.remoteStream = e.streams[0];
      this.callStatus = "Connected";
      this.refresh();
      setTimeout(() => {
        if (this.remoteVideo)
          this.remoteVideo.nativeElement.srcObject = this.remoteStream!;
      }, 50);
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "failed") {
        this.error =
          "Call connection failed. A TURN relay may be needed for this network.";
        this.run(this.endCall());
      }
      this.refresh();
    };
    this.refresh();
    setTimeout(() => {
      if (this.localVideo)
        this.localVideo.nativeElement.srcObject = this.localStream!;
    }, 50);
  }
  async answerCall(accept: boolean) {
    if (!accept) {
      await this.emit("call:respond", { accept: false });
      this.cleanCall();
      return;
    }
    try {
      await this.prepareMedia(this.call.video);
      await this.emit("call:respond", { accept: true });
      this.call.incoming = false;
      this.callStatus = "Connecting…";
    } catch (e) {
      await this.emit("call:end").catch(() => {});
      this.cleanCall();
      throw e;
    }
  }
  async makeOffer() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.emit("call:signal", {
      signal: { type: offer.type, sdp: offer.sdp },
    });
    this.callStatus = "Connecting…";
  }
  async signal(signal: any) {
    if (!this.pc) return;
    if (signal.candidate) {
      if (this.pc.remoteDescription)
        await this.pc.addIceCandidate(signal.candidate);
      else this.pendingCandidates.push(signal.candidate);
      return;
    }
    await this.pc.setRemoteDescription(signal);
    for (const c of this.pendingCandidates) await this.pc.addIceCandidate(c);
    this.pendingCandidates = [];
    if (signal.type === "offer") {
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this.emit("call:signal", {
        signal: { type: answer.type, sdp: answer.sdp },
      });
    }
  }
  async endCall() {
    await this.emit("call:end").catch(() => {});
    this.cleanCall();
  }
  cleanCall() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = undefined;
    this.localStream = undefined;
    this.remoteStream = undefined;
    this.call = null;
    this.muted = false;
    this.videoOff = false;
    this.refresh();
  }
  toggleMic() {
    this.muted = !this.muted;
    this.localStream
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !this.muted));
  }
  toggleVideo() {
    this.videoOff = !this.videoOff;
    this.localStream
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = !this.videoOff));
  }
}
bootstrapApplication(App, {
  providers: [provideZonelessChangeDetection()],
}).catch(console.error);
