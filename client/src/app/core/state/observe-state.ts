import { ChangeDetectorRef, effect, inject } from "@angular/core";
import { ChatState } from "./chat.state";
/** Bridge external socket/media callbacks to zoneless Angular. Auto-disposed with the view. */
export function observeState() {
  const state = inject(ChatState);
  const changeDetector = inject(ChangeDetectorRef);
  return effect(() => {
    state.revision();
    changeDetector.markForCheck();
  });
}
