import { Injectable, inject } from "@angular/core";
import { CallSignal } from "../../shared/models/chat.models";
import { ChatState } from "../../core/state/chat.state";
import { ApiClient } from "../../core/http/api-client.service";
import { RealtimeClient } from "../../core/realtime/realtime-client.service";
import { ViewRegistry } from "../../shared/directives/view-registry.directive";
@Injectable({ providedIn: "root" })
export class CallsService {
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteStream?: MediaStream;
  private localStream?: MediaStream;
  private pc?: RTCPeerConnection;
  private readonly state = inject(ChatState);
  private readonly apiClient = inject(ApiClient);
  private readonly realtime = inject(RealtimeClient);
  private readonly views = inject(ViewRegistry);
  async callPeer(video: boolean) {
    if (this.state.call) throw new Error("End your current call first.");
    if (!this.state.active?.peer) return;
    this.state.call = {
      room: this.state.active.id,
      video,
      from: this.state.active.peer,
      incoming: false,
    };
    this.state.callStatus = "Calling " + this.state.active.peer.name + "…";
    try {
      await this.prepareMedia(video);
      await this.realtime.request("call:invite", { room: this.state.active.id, video });
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
    const config = await this.apiClient.request<RTCConfiguration>("/rtc-config");
    this.pc = new RTCPeerConnection(config);
    this.pendingCandidates = [];
    for (const track of this.localStream.getTracks())
      this.pc.addTrack(track, this.localStream);
    this.pc.onicecandidate = (e) => {
      if (e.candidate)
        this.realtime
          .request("call:signal", {
            signal: { candidate: e.candidate.toJSON() },
          })
          .catch(() => {});
    };
    this.pc.ontrack = (e) => {
      this.remoteStream = e.streams[0];
      this.state.callStatus = "Connected";
      this.state.refresh();
      setTimeout(() => {
        if (this.views.remoteVideo)
          this.views.remoteVideo.nativeElement.srcObject = this.remoteStream!;
      }, 50);
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "failed") {
        this.state.error =
          "Call connection failed. A TURN relay may be needed for this network.";
        this.state.run(this.endCall());
      }
      this.state.refresh();
    };
    this.state.refresh();
    setTimeout(() => {
      if (this.views.localVideo)
        this.views.localVideo.nativeElement.srcObject = this.localStream!;
    }, 50);
  }

  async answerCall(accept: boolean) {
    const call = this.state.call;
    if (!call) return;
    if (!accept) {
      await this.realtime.request("call:respond", { accept: false });
      this.cleanCall();
      return;
    }
    try {
      await this.prepareMedia(call.video);
      if (this.state.call !== call) {
        this.cleanCall();
        return;
      }
      await this.realtime.request("call:respond", { accept: true });
      call.incoming = false;
      this.state.callStatus = "Connecting…";
    } catch (e) {
      await this.realtime.request("call:end").catch(() => {});
      this.cleanCall();
      throw e;
    }
  }

  async makeOffer() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.realtime.request("call:signal", {
      signal: { type: offer.type, sdp: offer.sdp },
    });
    this.state.callStatus = "Connecting…";
  }

  async signal(signal: CallSignal) {
    if (!this.pc) return;
    if ("candidate" in signal) {
      if (this.pc.remoteDescription) await this.pc.addIceCandidate(signal.candidate);
      else this.pendingCandidates.push(signal.candidate);
      return;
    }
    await this.pc.setRemoteDescription(signal);
    for (const c of this.pendingCandidates) await this.pc.addIceCandidate(c);
    this.pendingCandidates = [];
    if (signal.type === "offer") {
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this.realtime.request("call:signal", {
        signal: { type: answer.type, sdp: answer.sdp },
      });
    }
  }

  async endCall() {
    await this.realtime.request("call:end").catch(() => {});
    this.cleanCall();
  }

  cleanCall() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = undefined;
    this.localStream = undefined;
    this.remoteStream = undefined;
    this.state.call = null;
    this.state.muted = false;
    this.state.videoOff = false;
    this.state.refresh();
  }

  toggleMic() {
    this.state.muted = !this.state.muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !this.state.muted));
  }

  toggleVideo() {
    this.state.videoOff = !this.state.videoOff;
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = !this.state.videoOff));
  }
}
