import { Injectable, OnDestroy } from "@angular/core";
import { io, Socket } from "socket.io-client";
@Injectable({ providedIn: "root" })
export class RealtimeClient implements OnDestroy {
  socket!: Socket;
  connect() {
    this.disconnect();
    this.socket = io({ withCredentials: true });
  }
  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
  }
  ngOnDestroy() {
    this.disconnect();
  }
  request<T = unknown>(event: string, data: unknown = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected)
        return reject(new Error("Connection lost. Please wait for reconnection."));
      this.socket
        .timeout(10000)
        .emit(
          event,
          data,
          (error: Error | null, result: { ok: boolean; data: T; error?: string }) => {
            if (error)
              return reject(
                new Error("Request timed out. Check the conversation before retrying."),
              );
            if (!result?.ok) return reject(new Error(result?.error || "Action failed"));
            resolve(result.data);
          },
        );
    });
  }
}
