import { expect, userEvent, waitFor } from 'storybook/test';
import { MockChannel, MockOptions } from '../src/testing/mock-channel';
import { NODE_ID } from '../src/testing/fixtures';

/**
 * Story plumbing: build a real widget, wire it to a `MockChannel`, frame it.
 *
 * Stories return DOM nodes (the web-components renderer accepts them), which
 * lets object props such as `channelFactory` be set as properties.
 */

export type Mounted<T extends HTMLElement = HTMLElement> = { root: HTMLElement; el: T; channel: () => MockChannel };

export function frame(child: HTMLElement, size: { height?: number | string; width?: number | string } = {}): HTMLElement {
    const box = document.createElement('div');
    box.style.height = typeof size.height === 'number' ? `${size.height}px` : (size.height ?? '520px');
    box.style.width = typeof size.width === 'number' ? `${size.width}px` : (size.width ?? '100%');
    box.style.maxWidth = '100%';
    box.style.position = 'relative';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.appendChild(child);
    return box;
}

/** Creates `<tag>` with `props` set as properties and a mock channel behind it. */
export function mount<T extends HTMLElement = HTMLElement>(tag: string, props: Record<string, unknown>, mock?: MockOptions, size?: { height?: number | string; width?: number | string }): Mounted<T> {
    const ref: { current?: MockChannel } = {};
    const el = document.createElement(tag) as T;
    if (mock) {
        (el as any).channelFactory = MockChannel.factory(mock, ref);
    }
    Object.assign(el, { nodeId: NODE_ID, token: 'story-token', ...props });
    const root = frame(el, size);
    (root as any).__mounted = { el, channel: () => ref.current! };
    return { root, el, channel: () => ref.current! };
}

/** The `Mounted` a story's root carries, from inside `play`. */
export function mounted<T extends HTMLElement = HTMLElement>(canvasElement: HTMLElement): Mounted<T> {
    const root = canvasElement.firstElementChild as any;
    return { root, ...root.__mounted };
}

/** Finds `selector` inside an element's shadow root, waiting until it appears. */
export async function inShadow<T extends Element = HTMLElement>(host: Element | null | undefined, selector: string, timeout = 3000): Promise<T> {
    let found: T | null = null;
    await waitFor(
        () => {
            found = (host?.shadowRoot?.querySelector(selector) as T | null) ?? null;
            expect(found, `${selector} in <${host?.tagName.toLowerCase()}>`).toBeTruthy();
        },
        { timeout },
    );
    return found!;
}

export function allInShadow<T extends Element = HTMLElement>(host: Element | null | undefined, selector: string): T[] {
    return Array.from(host?.shadowRoot?.querySelectorAll(selector) ?? []) as T[];
}

/** Waits until the shadow root's text contains `text`. */
export async function shadowText(host: Element | null | undefined, text: string | RegExp, timeout = 3000) {
    await waitFor(
        () => {
            const content = host?.shadowRoot?.textContent ?? '';
            if (typeof text === 'string') {
                expect(content).toContain(text);
            } else {
                expect(content).toMatch(text);
            }
        },
        { timeout },
    );
}

/** The downloader inside an SFTP client. */
export async function hostedDownloader(sftp: HTMLElement): Promise<HTMLElement> {
    return inShadow(sftp, 'phirepass-downloader');
}

export function buttonByLabel(host: Element, label: string | RegExp): HTMLButtonElement | undefined {
    const matches = allInShadow<HTMLButtonElement>(host, 'button').filter(b => {
        const text = b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '';
        return typeof label === 'string' ? text === label : label.test(text);
    });
    // An open dialog sits above everything: its buttons win over a row's of the same name.
    return matches.find(b => b.closest('.modal, [role=dialog], [role=alertdialog]')) ?? matches[0];
}

/** Waits for an enabled button: a click on one that is still disabled after an input would do nothing. */
export async function waitForButton(host: Element, label: string | RegExp, timeout = 3000): Promise<HTMLButtonElement> {
    let button: HTMLButtonElement | undefined;
    await waitFor(
        () => {
            button = buttonByLabel(host, label);
            expect(button, `button ${label}`).toBeTruthy();
            expect(button!.disabled, `button ${label} enabled`).toBe(false);
        },
        { timeout },
    );
    return button!;
}

/** Sets an input's value the way typing does, for inputs inside shadow roots. */
export function typeInto(input: HTMLInputElement, value: string) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Row actions in the SFTP listing show on hover or on the selected row. A
 * synthetic hover cannot trigger `:hover`, so select the row (as a click on
 * it does), then press the action.
 */
export async function clickRowAction(host: Element, label: string) {
    const button = await waitForButton(host, label);
    const row = button.closest('tr');
    if (row) {
        await userEvent.click(row.querySelector('td')!);
    }
    await waitFor(() => expect(getComputedStyle(button).pointerEvents).not.toBe('none'));
    await userEvent.click(button);
}
