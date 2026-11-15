import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { PositionStore, RemotePlaybackLike, StoredPosition } from '../../src/components/phirepass-media-player/player';
import { frame, inShadow, waitForButton } from '../helpers';

const meta: Meta = {
    title: 'Remote Fetch/8 · Player',
    parameters: { docs: { description: { component: 'The browser’s own `<video>`/`<audio>` on a stream URL. Each phase (G–G7) is its own story.' } } },
};
export default meta;

type Story = StoryObj;

function player(props: Record<string, unknown>, height = 360) {
    const el = document.createElement('phirepass-media-player') as HTMLElement & Record<string, any>;
    Object.assign(el, { src: '/assets/sample.webm', name: 'big_buck_bunny_1080p.webm', status: 'Downloading · 38.7%', ...props });
    const root = frame(el, { height, width: 640 });
    (root as any).__player = el;
    return root;
}

const playerIn = (canvas: HTMLElement) => canvas.querySelector('phirepass-media-player') as HTMLElement & Record<string, any>;
const phase = (el: HTMLElement) => el.shadowRoot?.querySelector<HTMLElement>('.stage')?.dataset.phase;
const media = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLMediaElement>('video, audio')!;

/** G: Play while downloading. Buffering, then the picture. */
export const G_PlayWhileDownloading: Story = {
    name: 'G · Play while downloading',
    render: () => player({ ready: 356_000_000 }),
    play: async ({ canvasElement }) => {
        const el = playerIn(canvasElement);
        await inShadow(el, 'video');
        expect(el.shadowRoot!.textContent).toContain('Downloading · 38.7%');
        await waitFor(() => expect(phase(el)).toBe('playing'), { timeout: 6000 });
        const closed: unknown[] = [];
        el.addEventListener('phirepassPlayerClose', () => closed.push(1));
        await userEvent.click(await waitForButton(el, 'Close player'));
        expect(closed.length).toBe(1);
    },
};

/** G2: a seek past what the node has stalls; the player says why. */
export const G2_WaitingForPart: Story = {
    name: 'G2 · Waiting for this part',
    render: () => player({ ready: 120_000_000 }),
    play: async ({ canvasElement }) => {
        const el = playerIn(canvasElement);
        await waitFor(() => expect(phase(el)).toBe('playing'), { timeout: 6000 });
        media(el).dispatchEvent(new Event('playing'));
        media(el).dispatchEvent(new Event('waiting'));
        await waitFor(() => expect(phase(el)).toBe('waiting'));
        expect(el.shadowRoot!.textContent).toContain('Waiting for this part to download');
        media(el).dispatchEvent(new Event('canplay'));
        await waitFor(() => expect(phase(el)).toBe('playing'));
    },
};

/** G3: a format the browser cannot decode. */
export const G3_Unsupported: Story = {
    name: 'G3 · Format not supported',
    render: () => player({ src: '/assets/not-a-video.mkv', name: 'Sintel.2010.1080p.mkv', status: 'On the node' }),
    play: async ({ canvasElement }) => {
        const el = playerIn(canvasElement);
        await waitFor(() => expect(phase(el)).toBe('unsupported'), { timeout: 6000 });
        expect(el.shadowRoot!.textContent).toContain('This browser cannot play this format');
        const link = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[download]')!;
        expect(link.getAttribute('download')).toBe('Sintel.2010.1080p.mkv');
        // MKV cannot be cast either; the button says so instead of hiding.
        expect(el.shadowRoot!.querySelector('[aria-label^="Cast unavailable"]')).toBeTruthy();
    },
};

/** G4: the connection to the node dropped mid-play. */
export const G4_ConnectionLost: Story = {
    name: 'G4 · Connection lost',
    render: () => player({}),
    play: async ({ canvasElement }) => {
        const el = playerIn(canvasElement);
        await waitFor(() => expect(phase(el)).toBe('playing'), { timeout: 6000 });
        const m = media(el);
        Object.defineProperty(m, 'error', { configurable: true, get: () => ({ code: 2, message: 'network' }) });
        m.dispatchEvent(new Event('error'));
        await waitFor(() => expect(phase(el)).toBe('stopped'));
        expect(el.shadowRoot!.textContent).toContain('The connection to the node was lost.');
        delete (m as any).error;
        await userEvent.click(await waitForButton(el, 'Try again'));
        await waitFor(() => expect(phase(el)).toBe('playing'), { timeout: 6000 });
    },
};

/** G5: audio gets a slim player and no cast button. */
export const G5_Audio: Story = {
    name: 'G5 · Audio',
    render: () => player({ src: '/assets/podcast-ep-212.mp3', name: 'podcast-ep-212.mp3', status: 'On the node' }, 160),
    play: async ({ canvasElement }) => {
        const el = playerIn(canvasElement);
        await inShadow(el, 'audio');
        expect(el.classList.contains('audio')).toBe(true);
        expect(el.shadowRoot!.querySelector('video')).toBeNull();
        expect(el.shadowRoot!.querySelector('[aria-label="Cast"]')).toBeNull();
    },
};

function memoryStore(initial: Record<string, StoredPosition>): PositionStore & { data: Record<string, StoredPosition> } {
    const data = { ...initial };
    return {
        data,
        async get(key) {
            return data[key] ?? null;
        },
        async set(key, secs, duration) {
            data[key] = { secs, duration, at: Date.now() };
        },
        async clear(key) {
            delete data[key];
        },
    };
}

/** G6: continue watching from where it stopped. */
export const G6_ContinueWatching: Story = {
    name: 'G6 · Continue watching',
    render: () =>
        player({
            positionKey: 'dl:dl-1:0',
            positionStore: memoryStore({ 'dl:dl-1:0': { secs: 1872, duration: 5940, at: Date.now() - 86_400_000 } }),
            status: 'On the node',
        }),
    play: async ({ canvasElement }) => {
        const el = playerIn(canvasElement);
        await waitFor(() => expect(phase(el)).toBe('prompt'));
        expect(el.shadowRoot!.textContent).toMatch(/Resume from 31:12\?/);
        expect(media(el).classList.contains('hidden')).toBe(true);
        await userEvent.click(await waitForButton(el, 'Start over'));
        await waitFor(() => expect(phase(el)).not.toBe('prompt'));
        expect(media(el).currentTime).toBeLessThan(2);
    },
};

function fakeRemote(): RemotePlaybackLike & { fire(type: 'connect' | 'disconnect'): void } {
    const listeners: Record<string, Array<() => void>> = {};
    const remote = {
        state: 'disconnected' as RemotePlaybackLike['state'],
        async watchAvailability(cb: (available: boolean) => void) {
            cb(true);
            return 1;
        },
        async cancelWatchAvailability() {},
        async prompt() {
            remote.state = 'connected';
            remote.fire('connect');
        },
        addEventListener(type: string, cb: () => void) {
            (listeners[type] ??= []).push(cb);
        },
        removeEventListener(type: string, cb: () => void) {
            listeners[type] = (listeners[type] ?? []).filter(x => x !== cb);
        },
        fire(type: string) {
            (listeners[type] ?? []).forEach(cb => cb());
        },
    };
    return remote;
}

/** G7: casting to a TV; the TV reads from the node. */
export const G7_Casting: Story = {
    name: 'G7 · Casting',
    render: () => player({ remotePlayback: fakeRemote(), castDevice: 'Living room TV', status: 'On the node' }),
    play: async ({ canvasElement }) => {
        const el = playerIn(canvasElement);
        await userEvent.click(await waitForButton(el, 'Cast'));
        await waitFor(() => expect(phase(el)).toBe('casting'));
        expect(el.shadowRoot!.textContent).toContain('Playing on Living room TV');
        (el.remotePlayback as ReturnType<typeof fakeRemote>).fire('disconnect');
        await waitFor(() => expect(phase(el)).not.toBe('casting'));
    },
};
