/**
 * Keyboard capture for the RDP widget, in two layers.
 *
 * **Ordinary keys** are IronRDP's own doing: it listens on `window` and
 * forwards a key event only while its element is `document.activeElement`. That
 * check is why the client element is mounted in the widget's *light* DOM — see
 * the note on `mount_client` in the component — and why it has to be focused,
 * which `focus_client` below is for.
 *
 * **Keys the browser reserves** (Ctrl+W, Ctrl+T, Ctrl+N, Alt+Tab, F11, Escape)
 * never reach the page at all, so no amount of focus will forward them. The
 * only way to have them is the Keyboard Lock API, and browsers grant that only
 * to a document that is already fullscreen. So "capture my keyboard" is really
 * "go fullscreen, then lock" — hence `toggle_fullscreen`.
 */

type KeyboardLockApi = {
    lock(keyCodes?: string[]): Promise<void>;
    unlock(): void;
};

function keyboard_api(): KeyboardLockApi | undefined {
    return (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard;
}

/** Chromium-only at the time of writing; Firefox and Safari have no equivalent. */
export function keyboard_lock_supported(): boolean {
    return typeof keyboard_api()?.lock === 'function';
}

/** Strictly this element — what deciding whether to enter or exit turns on. */
export function is_fullscreen(element: Element): boolean {
    return document.fullscreenElement === element;
}

/**
 * This element *or* something around it. The lock is granted per document, so
 * a host app that made a whole panel fullscreen should get it too.
 */
export function shown_fullscreen(element: Element): boolean {
    return document.fullscreenElement?.contains(element) ?? false;
}

/**
 * Takes every key the browser is willing to give up. Called with no arguments
 * `lock()` claims the lot, including Escape — which is also the key that leaves
 * fullscreen, so the browser substitutes a press-and-hold gesture for it.
 */
export async function lock_keyboard(element: Element): Promise<void> {
    // There is no capability query, and the request rejects outside fullscreen,
    // so the caller's state is the only guard available.
    if (!keyboard_lock_supported() || !shown_fullscreen(element)) {
        return;
    }

    try {
        await keyboard_api()!.lock();
    } catch (err) {
        console.warn('Failed to lock the keyboard for the RDP session:', err);
    }
}

export function unlock_keyboard(): void {
    if (!keyboard_lock_supported()) {
        return;
    }

    try {
        keyboard_api()!.unlock();
    } catch (err) {
        console.warn('Failed to release the keyboard lock:', err);
    }
}

/** Returns whether `element` is fullscreen once the request has settled. */
export async function toggle_fullscreen(element: HTMLElement): Promise<boolean> {
    try {
        if (is_fullscreen(element)) {
            await document.exitFullscreen();
            return false;
        }

        await element.requestFullscreen({ navigationUI: 'hide' });
        return true;
    } catch (err) {
        console.warn('Failed to change the fullscreen state of the RDP session:', err);
        return is_fullscreen(element);
    }
}

/**
 * Gives the client element focus so IronRDP starts forwarding keys.
 *
 * The element's shadow root is opened with `delegatesFocus`, so focusing the
 * host lands on the canvas inside it; the canvas is what IronRDP watches. Doing
 * this on connect saves the user the mouse-over that would otherwise be needed
 * before the first keystroke lands.
 */
export function focus_client(element: HTMLElement | undefined): void {
    element?.focus({ preventScroll: true });
}
