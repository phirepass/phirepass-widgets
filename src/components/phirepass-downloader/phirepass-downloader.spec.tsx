import { describe, expect, it, vi } from 'vitest';
import { h, render } from '@stencil/vitest';

vi.mock('phirepass-channel', () => ({ __esModule: true, default: vi.fn(), Channel: vi.fn() }));

import './phirepass-downloader';
import { caps, job } from '../../testing/fixtures';
import { MockChannel, MockOptions } from '../../testing/mock-channel';

const until = async (check: () => boolean, waitForChanges: () => Promise<void>, what: string) => {
    for (let i = 0; i < 100; i++) {
        await waitForChanges();
        if (check()) {
            return;
        }
        await new Promise(r => setTimeout(r, 10));
    }
    throw new Error(`timed out waiting for ${what}`);
};

async function mount(props: Record<string, unknown>, mock: MockOptions = { downloads: { caps: caps(), jobs: [] } }) {
    const ref: { current?: MockChannel } = {};
    const factory = vi.fn(MockChannel.factory(mock, ref));
    const rendered = await render(h('phirepass-downloader', { nodeId: 'node-1', nodeLabel: 'raspberrypi', token: 't', channelFactory: factory, ...props }));
    const shadow = () => rendered.root.shadowRoot!;
    return { ...rendered, factory, ref, shadow };
}

describe('phirepass-downloader', () => {
    it('lists the node’s downloads after connecting', async () => {
        const { shadow, waitForChanges } = await mount({}, { downloads: { caps: caps(), jobs: [job({ name: 'big.iso', state: 'Downloading', done_bytes: 1, total_bytes: 10 })] } });
        await until(() => !!shadow().querySelector('.job'), waitForChanges, 'a row');
        expect(shadow().querySelector('.job .nm')!.textContent).toBe('big.iso');
    });

    it('uses an injected channel and never builds its own', async () => {
        const injected = new MockChannel('wss://x', 'node-1', { downloads: { caps: caps(), jobs: [] } });
        injected.connect();
        const { factory, waitForChanges } = await mount({ channel: injected, connected: true });
        await waitForChanges();
        expect(factory).not.toHaveBeenCalled();
        expect(injected.callsTo('send_download_subscribe').length).toBeGreaterThan(0);
    });

    it('says so when the channel predates Remote Fetch', async () => {
        const { shadow, waitForChanges } = await mount({}, {});
        await until(() => /Downloads are not available here/.test(shadow().textContent ?? ''), waitForChanges, 'the unsupported screen');
    });

    it('asks to sign in without a token', async () => {
        const { shadow, waitForChanges, factory } = await mount({ token: undefined });
        await until(() => /Sign in to PhirePass/.test(shadow().textContent ?? ''), waitForChanges, 'the sign-in screen');
        expect(factory).not.toHaveBeenCalled();
    });

    it('keeps Start disabled for a torrent until an order is chosen', async () => {
        const { root, shadow, waitForChanges } = await mount({ compact: true });
        await waitForChanges();
        await (root as any).openFetch();
        await until(() => !!shadow().querySelector('#fetch-link'), waitForChanges, 'the dialog');
        const input = shadow().querySelector<HTMLInputElement>('#fetch-link')!;
        input.value = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel';
        input.dispatchEvent(new Event('input'));
        await until(() => !!shadow().querySelector('input[value="in"]'), waitForChanges, 'the order choice');
        const start = () => Array.from(shadow().querySelectorAll('button')).find(b => b.textContent?.trim() === 'Start download') as HTMLButtonElement;
        await until(() => !!start(), waitForChanges, 'the Start button');
        expect(start().hasAttribute('disabled')).toBe(true);
        shadow().querySelector<HTMLInputElement>('input[value="in"]')!.dispatchEvent(new Event('change'));
        await until(() => !start().hasAttribute('disabled'), waitForChanges, 'Start enabled');
    });

    it('reports the number of running downloads', async () => {
        const counts: number[] = [];
        const { root, waitForChanges, ref } = await mount(
            {},
            { downloads: { caps: caps(), jobs: [job({ state: 'Downloading' }), job({ state: 'Retrying' }), job({ state: 'Completed' })] } },
        );
        root.addEventListener('phirepassActiveCount', e => counts.push((e as CustomEvent).detail.n));
        await until(() => !!ref.current, waitForChanges, 'the channel');
        ref.current!.progress(job({ state: 'Queued' }));
        await until(() => counts.includes(2), waitForChanges, 'a count of 2');
    });
});
