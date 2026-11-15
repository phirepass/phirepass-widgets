import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { everyState, moreStates } from '../../src/testing/fixtures';
import { embedded, rowButton, rowNamed } from '../fetch-helpers';
import { allInShadow, inShadow, mounted } from '../helpers';

const meta: Meta = {
    title: 'Remote Fetch/5 · Every state of a download',
    parameters: { docs: { description: { component: 'One row per `FetchState`, with the buttons each state offers. Nothing is ever Failed.' } } },
};
export default meta;

type Story = StoryObj;

const buttons = (row: HTMLElement) => Array.from(row.querySelectorAll('.acts button')).map(b => b.getAttribute('aria-label'));

async function openDrawer(el: HTMLElement) {
    await (el as any).toggleDrawer(true);
    await inShadow(el, '.drawer .job');
}

/** R: Queued, Connecting, Fetching metadata, Downloading (link, in order, fastest), Stopped, Retrying, Completed, Cancelled, Deleting. */
export const R_EveryState: Story = {
    name: 'R · Every download state',
    render: () => embedded({ jobs: everyState() }, { height: 900 }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await openDrawer(el);
        await waitFor(() => expect(allInShadow(el, '.job').length).toBe(10));

        expect((await rowNamed(el, 'nightly-build-4412.zip')).textContent).toContain('Waiting for a free slot');
        expect((await rowNamed(el, 'bbb_sunflower_1080p_60fps_normal.mp4')).textContent).toContain('Connecting');
        expect(buttons(await rowNamed(el, 'big_buck_bunny_1080p.mp4'))).toEqual(['Play while downloading', 'Pause', 'Stop']);
        expect(buttons(await rowNamed(el, 'Sintel.2010.1080p.mkv'))).toEqual(['Play while downloading', 'Pause', 'Stop']);

        // A Fastest torrent offers “Switch to in order to watch” instead of Play.
        const fastest = await rowNamed(el, 'ubuntu-26.04-desktop-amd64.iso');
        expect(buttons(fastest)).toEqual(['Pause', 'Stop']);
        await userEvent.click(rowButton(fastest, 'Switch to in order to watch'));
        await waitFor(() => expect(channel().callsTo('send_download_set_order')[0].slice(1, 2)).toEqual([true]));
        await waitFor(async () => expect(buttons(await rowNamed(el, 'ubuntu-26.04-desktop-amd64.iso'))[0]).toBe('Play while downloading'));

        expect(buttons(await rowNamed(el, 'dataset-2026.tar.zst'))).toEqual(['Resume', 'Delete']);
        expect(buttons(await rowNamed(el, 'nightly-build.zip'))).toEqual(['Try now', 'Stop']);
        expect(buttons(await rowNamed(el, 'debian-13.2.0-amd64-netinst'))).toEqual(['Show in folder', 'Remove from list']);
        expect((await rowNamed(el, 'old-iso.img')).textContent).toContain('Resume starts from zero');

        // Deleting… until the node confirms.
        await userEvent.click(rowButton(await rowNamed(el, 'old-iso.img'), 'Remove from list'));
        await waitFor(async () => expect((await rowNamed(el, 'old-iso.img')).dataset.state).toBe('Deleting'));
        await waitFor(() => expect(allInShadow(el, '.job').length).toBe(9));
        expect(el.shadowRoot!.textContent).not.toMatch(/Failed/);
    },
};

/** R2: Checking pieces, Seeding, Scheduled, Paused for the disk, and a link with a login. */
export const R2_TorrentScheduleDisk: Story = {
    name: 'R2 · Torrent, schedule and disk states',
    render: () => embedded({ jobs: moreStates() }, { height: 640 }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await openDrawer(el);
        expect((await rowNamed(el, 'ubuntu-26.04-desktop-amd64.iso')).textContent).toContain('Checking downloaded pieces after a restart');
        const seeding = await rowNamed(el, 'debian-13.2.0-amd64-netinst');
        expect(seeding.textContent).toContain('2.31 GB uploaded');
        expect(seeding.textContent).toContain('seeding for 3d, until you delete it');
        const scheduled = await rowNamed(el, 'dataset-2026.tar.zst');
        expect(scheduled.textContent).toContain('Waits for the download window');
        await userEvent.click(rowButton(scheduled, 'Start now'));
        await waitFor(() => expect(channel().callsTo('send_download_resume')[0].slice(1, 2)).toEqual([true]));
        const disk = await rowNamed(el, 'big_buck_bunny_1080p.mp4');
        expect(disk.textContent).toContain('Paused · disk almost full');
        expect(disk.textContent).toContain('1.6 GB free on /srv/downloads, the floor is 2 GB');
        expect(buttons(disk)).not.toContain('Start now');
    },
};
