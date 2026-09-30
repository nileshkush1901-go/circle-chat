export interface Person {
  id: string;
  name: string;
  color: string;
  bio: string;
  guest: boolean;
  role: string;
  blocked?: string[];
  online?: boolean;
}

export interface Room {
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

export interface Msg {
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

export interface Stroke {
  color: string;
  points: number[][];
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
}
export interface WatchState {
  attachment: string;
  playing: boolean;
  time: number;
  at: number;
}
export interface CallState {
  room: string;
  video: boolean;
  from: Person;
  incoming: boolean;
}
export interface ModerationReport {
  id: string;
  createdAt: string;
  reason: string;
  content: Msg | null;
}
export type CallSignal = { candidate: RTCIceCandidateInit } | RTCSessionDescriptionInit;
