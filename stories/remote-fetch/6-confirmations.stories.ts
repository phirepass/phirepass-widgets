import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { everyState, finishedJobs, job, moreStates } from '../../src/testing/fixtures';
import { embedded, openDialog, rowButton, rowNamed, standalone } from '../fetch-helpers';
import { inShadow, mounted, typeInto, waitForButton } from '../helpers';

const meta: Meta = {
    title: 'Remote Fetch/6 · Confirmations',
    parameters: { docs: { description: { component: 'Only actions that destroy data, stop playback or expose the node ask first.' } } },
};
export default meta;

type Story = StoryObj;

async function drawer(el: HTMLElement) {
    await (el as any).toggleDrawer(true);
    await inShadow(el, '.drawer .job');
}

/** K1: ✕ on an unfinished row. Unticked the row is Stopped; ticked it is Cancelled. */
export const K1_StopDownload: Story = {
    name: 'K1 · Stop a download',
    render: () => embedded({ jobs: everyState() }, { height: 640 }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await drawer(el);
        await userEvent.click(rowButton(await rowNamed(el, 'big_buck_bunny_1080p.mp4'), 'Stop'));
        const dialog = await inShadow(el, '[aria-label="Stop this download?"]');
        expect(dialog.textContent).toContain('356 MB of 920 MB downloaded');
        await userEvent.click(dialog.querySelector('input[type=checkbox]')!);
        await userEvent.click(await waitForButton(el, 'Stop download'));
        await waitFor(() => expect(channel().callsTo('send_download_stop')[0].slice(1, 2)).toEqual([true]));
        await waitFor(async () => expect((await rowNamed(el, 'big_buck_bunny_1080p.mp4')).dataset.state).toBe('Cancelled'));
    },
};

/** K8: Delete on a seeding torrent: it stops sharing; the files stay unless asked. */
export const K8_DeleteDownload: Story = {
    name: 'K8 · Delete a download',
    render: () => embedded({ jobs: moreStates() }, { height: 640 }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await drawer(el);
        await userEvent.click(rowButton(await rowNamed(el, 'debian-13.2.0-amd64-netinst'), 'Delete'));
        const dialog = await inShadow(el, '[aria-label="Delete this download?"]');
        expect(dialog.textContent).toContain('raspberrypi stops sharing it with peers.');
        expect(dialog.textContent).toContain('Also delete the files');
        await userEvent.click(await waitForButton(el, 'Delete'));
        await waitFor(() => expect(channel().callsTo('send_download_delete')[0].slice(1, 2)).toEqual([false]));
    },
};

/** K8 on a stopped download: its part is deleted with it, so there is no box. */
export const K8_DeleteUnfinished: Story = {
    name: 'K8 · Delete an unfinished download',
    render: () => standalone({ jobs: [job({ name: 'dataset-2026.tar.zst', state: 'Stopped', done_bytes: 38_000_000, total_bytes: 100_000_000 })] }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await userEvent.click(rowButton(await rowNamed(el, 'dataset-2026.tar.zst'), 'Delete'));
        const dialog = await inShadow(el, '[aria-label="Delete this download?"]');
        expect(dialog.textContent).toContain('The part already downloaded is deleted.');
        expect(dialog.querySelector('input[type=checkbox]')).toBeNull();
    },
};

/** K9: switching a torrent that is playing to Fastest asks first. */
export const K9_SwitchToFastestWhilePlaying: Story = {
    name: 'K9 · Switch to fastest while playing',
    render: () => embedded({ jobs: everyState() }, { height: 720 }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await drawer(el);
        const row = await rowNamed(el, 'Sintel.2010.1080p.mkv');
        await userEvent.click(rowButton(row, 'Play while downloading'));
        await inShadow(el, 'phirepass-media-player');
        await userEvent.click(rowButton(await rowNamed(el, 'Sintel.2010.1080p.mkv'), 'Switch to fastest'));
        const dialog = await inShadow(el, '[aria-label="Switch to fastest?"]');
        expect(dialog.textContent).toContain('Sintel.2010.1080p.mkv is playing.');
        await userEvent.click(await waitForButton(el, 'Switch and stop playback'));
        await waitFor(() => expect(channel().callsTo('send_download_set_order')[0].slice(1, 2)).toEqual([false]));
        await waitFor(() => expect(el.shadowRoot!.querySelector('phirepass-media-player')).toBeNull());
    },
};

/** K2: before the first torrent on this browser. */
export const K2_FirstTorrent: Story = {
    name: 'K2 · First torrent on this browser',
    render: () => {
        try {
            localStorage.removeItem('phirepass.downloader.torrent-ack');
        } catch {
            // storage may be unavailable
        }
        return embedded({ jobs: [] }).root;
    },
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const modal = await openDialog(el);
        typeInto(modal.querySelector<HTMLInputElement>('#fetch-link')!, 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel');
        await userEvent.click(await waitFor(() => {
            const r = modal.querySelector<HTMLInputElement>('input[value="fast"]');
            expect(r).toBeTruthy();
            return r!;
        }));
        await userEvent.click(await waitForButton(el, 'Start download'));
        const dialog = await inShadow(el, '[aria-label="Start a torrent on raspberrypi?"]');
        expect(dialog.textContent).toContain('They can see its internet address');
        expect(dialog.textContent).toContain('keeps sharing it with other peers until you delete it');
        expect(channel().callsTo('send_download_start')).toEqual([]);
        await userEvent.click(await waitForButton(el, 'Start torrent'));
        await waitFor(() => expect(channel().callsTo('send_download_start').length).toBe(1));
    },
};

/** K5: the node refused a Start that would not fit. A notice, not a question. */
export const K5_NotEnoughSpace: Story = {
    name: 'K5 · Not enough space',
    render: () => standalone({ jobs: finishedJobs().slice(0, 1), onStart: 'refuse', refuseReason: 'This download needs 6.05 GB. /home/pi/Downloads has 4.2 GB free.' }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        typeInto(await inShadow<HTMLInputElement>(el, '#fetch-link'), 'https://releases.ubuntu.com/26.04/ubuntu-26.04-desktop-amd64.iso');
        await userEvent.click(await waitForButton(el, 'Download'));
        const dialog = await inShadow(el, '[aria-label="Not enough space"]');
        expect(dialog.textContent).toContain('This download needs 6.05 GB. /home/pi/Downloads has 4.2 GB free.');
        await userEvent.click(await waitForButton(el, 'OK'));
        await waitFor(() => expect(el.shadowRoot!.querySelector('[aria-label="Not enough space"]')).toBeNull());
    },
};
