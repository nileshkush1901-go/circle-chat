import {
  Directive,
  ElementRef,
  Injectable,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from "@angular/core";
type ViewName = "messageList" | "watchVideo" | "localVideo" | "remoteVideo";
@Injectable({ providedIn: "root" })
export class ViewRegistry {
  messageList?: ElementRef<HTMLElement>;
  watchVideo?: ElementRef<HTMLVideoElement>;
  localVideo?: ElementRef<HTMLVideoElement>;
  remoteVideo?: ElementRef<HTMLVideoElement>;
}
/** Registers conditional media/scroll elements and removes stale references on teardown. */
@Directive({ selector: "[appView]", standalone: true })
export class ViewRegistryDirective implements OnInit, OnDestroy {
  @Input({ required: true }) appView!: ViewName;
  private readonly views = inject(ViewRegistry);
  private readonly element = inject(ElementRef);
  ngOnInit() {
    this.views[this.appView] = this.element;
  }
  ngOnDestroy() {
    if (this.views[this.appView] === this.element) this.views[this.appView] = undefined;
  }
}
