import { describe, expect, it, vi } from 'vitest';
import { h, render } from '@stencil/vitest';
import './phirepass-media-player';
import type { PositionStore } from './player';

const phase = (root: HTMLElement) => root.shadowRoot!.querySelector<HTMLElement>('.stage')!.dataset.phase;

describe('phirepass-media-player', () => {
    it('renders a video with the status and starts buffering', async () => {
        const { root } = await render(h('phirepass-media-player', { src: '/s/1', name: 'film.mp4', status: 'Downloading · 38.7%' }));
        expect(root.shadowRoot!.querySelector('video')).toBeTruthy();
        expect(root.shadowRoot!.textContent).toContain('Downloading · 38.7%');
        expect(phase(root)).toBe('buffering');
    });

    it('uses an audio element for audio, with no cast button', async () => {
        const { root } = await render(h('phirepass-media-player', { src: '/s/2', name: 'ep.mp3' }));
        expect(root.shadowRoot!.querySelector('audio')).toBeTruthy();
        expect(root.classList.contains('audio')).toBe(true);
        expect(root.shadowRoot!.querySelector('[aria-label="Cast"]')).toBeNull();
    });

    it('explains why an MKV cannot be cast', async () => {
        const { root } = await render(h('phirepass-media-player', { src: '/s/3', name: 'film.mkv' }));
        expect(root.shadowRoot!.querySelector('[aria-label^="Cast unavailable"]')?.getAttribute('title')).toMatch(/MKV/);
    });

    it('offers to resume a stored position instead of autoplaying', async () => {
        const store: PositionStore = { get: vi.fn(async () => ({ secs: 600, duration: 3600, at: Date.now() })), set: vi.fn(async () => {}) };
        const { root } = await render(h('phirepass-media-player', { src: '/s/4', name: 'film.webm', positionKey: 'k', positionStore: store }));
        expect(phase(root)).toBe('prompt');
        expect(root.shadowRoot!.textContent).toContain('Resume from 10:00?');
        expect(root.shadowRoot!.querySelector('video')!.hasAttribute('autoplay')).toBe(false);
    });

    it('ignores a position from the first 30 seconds', async () => {
        const store: PositionStore = { get: async () => ({ secs: 12, duration: 3600, at: Date.now() }), set: async () => {} };
        const { root } = await render(h('phirepass-media-player', { src: '/s/5', name: 'film.webm', positionKey: 'k', positionStore: store }));
        expect(phase(root)).toBe('buffering');
    });

    it('tells a lost connection from an unsupported format', async () => {
        const { root, waitForChanges } = await render(h('phirepass-media-player', { src: '/s/6', name: 'film.webm' }));
        const video = root.shadowRoot!.querySelector('video')!;
        Object.defineProperty(video, 'error', { configurable: true, value: { code: 2 } });
        video.dispatchEvent(new Event('error'));
        await waitForChanges();
        expect(phase(root)).toBe('stopped');
        Object.defineProperty(video, 'error', { configurable: true, value: { code: 4 } });
        video.dispatchEvent(new Event('error'));
        await waitForChanges();
        expect(phase(root)).toBe('unsupported');
    });

    it('emits close from the close button', async () => {
        const { root, waitForChanges } = await render(h('phirepass-media-player', { src: '/s/7', name: 'film.webm' }));
        const closed = vi.fn();
        root.addEventListener('phirepassPlayerClose', closed);
        root.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Close player"]')!.click();
        await waitForChanges();
        expect(closed).toHaveBeenCalledTimes(1);
    });

    it('casts from a ticket URL and copies the same link for VLC', async () => {
        const minter = vi.fn(async (src: string) => `https://relay.example${src}?ticket=T`);
        const prompt = vi.fn(async () => {});
        const remote = { state: 'disconnected', prompt, watchAvailability: async (cb: (a: boolean) => void) => (cb(true), 1), cancelWatchAvailability: async () => {}, addEventListener() {}, removeEventListener() {} };
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        const { root, waitForChanges } = await render(h('phirepass-media-player', { src: '/s/9', name: 'film.mp4', linkMinter: minter, remotePlayback: remote }));
        await waitForChanges();
        root.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Cast"]')!.click();
        await new Promise(r => setTimeout(r, 0));
        await waitForChanges();
        expect(minter).toHaveBeenCalledWith('/s/9');
        expect(prompt).toHaveBeenCalled();
        expect(root.shadowRoot!.querySelector('video')!.src).toBe('https://relay.example/s/9?ticket=T');

        root.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Copy link for VLC"]')!.click();
        await new Promise(r => setTimeout(r, 0));
        await waitForChanges();
        expect(writeText).toHaveBeenCalledWith('https://relay.example/s/9?ticket=T');
        expect(minter).toHaveBeenCalledTimes(1);
        expect(root.shadowRoot!.textContent).toContain('Link copied');
    });
});
