import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { job } from '../../src/testing/fixtures';
import { rowNamed, standalone } from '../fetch-helpers';
import { inShadow, mounted, typeInto, waitForButton } from '../helpers';

const meta: Meta = {
    title: 'Remote Fetch/9 · Notices',
    parameters: { docs: { description: { component: 'Small notices at the bottom of the widget. Only “still retrying after a day” stays until dismissed.' } } },
};
export default meta;

type Story = StoryObj;

const LINK = 'https://releases.ubuntu.com/26.04/ubuntu-26.04-desktop-amd64.iso';

async function start(el: HTMLElement, link = LINK) {
    typeInto(await inShadow<HTMLInputElement>(el, '#fetch-link'), link);
    await userEvent.click(await waitForButton(el, 'Download'));
}

const notice = (el: HTMLElement, kind: string) => inShadow(el, `.toast[data-notice="${kind}"]`, 4000);

/** N1: the node took it. */
export const N1_Started: Story = {
    name: 'N1 · Download started',
    render: () => standalone({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await start(el);
        const toast = await notice(el, 'started');
        expect(toast.textContent).toContain('Download started');
        expect(toast.textContent).toContain('ubuntu-26.04-desktop-amd64.iso → /home/pi/Downloads');
        await userEvent.click(toast.querySelector<HTMLButtonElement>('[aria-label="Dismiss"]')!);
        await waitFor(() => expect(el.shadowRoot!.querySelector('.toast')).toBeNull());
    },
};

/** N2: the node has every slot busy. */
export const N2_Queued: Story = {
    name: 'N2 · Added to the queue',
    render: () => standalone({ jobs: [job({ name: 'Sintel.2010.1080p.mkv', state: 'Downloading', done_bytes: 300_000_000, total_bytes: 1_120_000_000 })], onStart: 'queued' }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await start(el);
        const toast = await notice(el, 'queued');
        expect(toast.textContent).toContain('Added to the queue');
        expect(toast.textContent).toContain('1 download is already running on this node');
    },
};

/** N3: retrying for a day; sticky, with a way to the row. */
export const N3_StillRetrying: Story = {
    name: 'N3 · Still retrying after a day',
    render: () => standalone({ jobs: [job({ download_id: 'dl-retry', name: 'nightly-build.zip', state: 'Retrying', retry_reason: 'Server answered 403 Forbidden', attempt: 31 })] }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await waitFor(() => expect(el.shadowRoot!.querySelector('[role=tab]')).toBeTruthy());
        channel().update('dl-retry', { attempt: 40, next_attempt_at: Date.now() + 3_600_000 });
        const toast = await notice(el, 'stuck');
        expect(toast.textContent).toContain('nightly-build.zip · Server answered 403 Forbidden');
        expect(toast.classList.contains('bad')).toBe(true);
        // A later progress frame does not raise it twice.
        channel().update('dl-retry', { attempt: 41 });
        await new Promise(r => setTimeout(r, 200));
        expect(el.shadowRoot!.querySelectorAll('.toast[data-notice="stuck"]').length).toBe(1);
    },
};

/** N4: a file with that name was already there. */
export const N4_Renamed: Story = {
    name: 'N4 · Saved under another name',
    render: () => standalone({ jobs: [], savedAs: 'report (1).pdf' }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await start(el, 'https://example.com/files/report.pdf');
        const toast = await notice(el, 'renamed');
        expect(toast.textContent).toContain('Saved as report (1).pdf');
        expect(toast.textContent).toContain('A file named report.pdf was already in /home/pi/Downloads');
    },
};

/** D: a download finished while the page was open. */
export const D_Completed: Story = {
    name: 'D · Download complete',
    render: () => standalone({ jobs: [job({ download_id: 'dl-done', name: 'home-assistant-backup.tar', state: 'Downloading', done_bytes: 800_000_000, total_bytes: 812_000_000 })] }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const completed: any[] = [];
        const shown: any[] = [];
        el.addEventListener('phirepassFetchCompleted', e => completed.push((e as CustomEvent).detail));
        el.addEventListener('phirepassShowInFolder', e => shown.push((e as CustomEvent).detail));
        await rowNamed(el, 'home-assistant-backup.tar');
        channel().update('dl-done', { state: 'Completed', done_bytes: 812_000_000, finished_at: Date.now() });
        const toast = await notice(el, 'completed');
        expect(toast.textContent).toContain('home-assistant-backup.tar → /home/pi/Downloads');
        expect(completed).toHaveLength(1);
        await userEvent.click(await waitForButton(el, 'Show'));
        expect(shown[0]).toEqual({ path: '/home/pi/Downloads', name: 'home-assistant-backup.tar' });
        // Another frame for the same finished job does not repeat it.
        channel().update('dl-done', { up_total: 0 });
        await new Promise(r => setTimeout(r, 200));
        expect(completed).toHaveLength(1);
    },
};
