import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { DOWNLOAD_FOLDER, finishedJobs, standaloneJobs } from '../../src/testing/fixtures';
import { rowButton, rowNamed, standalone, startArgs } from '../fetch-helpers';
import { allInShadow, inShadow, mounted, shadowText, typeInto, waitForButton } from '../helpers';

const meta: Meta = {
    title: 'Remote Fetch/2 · The downloader on its own',
    parameters: {
        docs: { description: { component: '`<phirepass-downloader node-id token>` with no SFTP client around it: its own page, an installed app, or the node card’s Downloads button.' } },
    },
};
export default meta;

type Story = StoryObj;

const tab = (el: HTMLElement, name: string) => allInShadow<HTMLButtonElement>(el, '[role=tab]').find(t => t.textContent?.startsWith(name))!;

/** H: desktop. Saves to the download folder, with tabs because it is the whole screen. */
export const H_Desktop: Story = {
    name: 'H · Desktop',
    render: () => standalone({ jobs: standaloneJobs(), folders: { '': ['movies', 'backups'] } }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await shadowText(el, `saving to ${DOWNLOAD_FOLDER}`);
        await waitFor(() => expect(tab(el, 'Active').textContent).toBe('Active2'));
        expect(tab(el, 'Finished').textContent).toBe('Finished3');
        expect(tab(el, 'Retrying').textContent).toBe('Retrying1');
        await shadowText(el, 'Sintel.2010.1080p.mkv');
        // Starting a link sends no browsing target: it saves into the download folder.
        typeInto(await inShadow<HTMLInputElement>(el, '#fetch-link'), 'https://downloads.raspberrypi.com/raspios.img.xz');
        await userEvent.click(await waitForButton(el, 'Download'));
        await waitFor(() => expect(startArgs(channel().callsTo('send_download_start'))).toMatchObject({ subDir: null, browsing: null, inOrder: true }));
    },
};

/** H3: the same widget at phone width. */
export const H3_Phone: Story = {
    name: 'H3 · Phone',
    render: () => standalone({ jobs: standaloneJobs() }, { width: 360, height: 640 }).root,
    parameters: { viewport: { defaultViewport: 'mobile1' } },
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await shadowText(el, 'raspios-bookworm-arm64-lite.img.xz');
        expect(el.getBoundingClientRect().width).toBeLessThanOrEqual(360);
        // No horizontal scroll inside the widget.
        expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth + 1);
    },
};

/** H4: the Finished tab. Finished rows stay until deleted; Clear finished never touches a seeding torrent. */
export const H4_FinishedTab: Story = {
    name: 'H4 · Finished tab',
    render: () => standalone({ jobs: finishedJobs() }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await waitFor(() => expect(tab(el, 'Finished')).toBeTruthy());
        await userEvent.click(tab(el, 'Finished'));
        await shadowText(el, '5 finished');
        await userEvent.click(await waitForButton(el, 'Clear finished'));
        await waitFor(() => expect(channel().callsTo('send_download_delete').length).toBe(4));
        expect(channel().callsTo('send_download_delete').every(c => c[1] === false)).toBe(true);
        await waitFor(() => expect(allInShadow(el, '.job').length).toBe(1));
        await shadowText(el, 'Seeding');
    },
};

/** H5: the Retrying tab. Try now skips the wait; Stop keeps the partial file. */
export const H5_RetryingTab: Story = {
    name: 'H5 · Retrying tab',
    render: () => standalone({ jobs: standaloneJobs() }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await waitFor(() => expect(tab(el, 'Retrying').textContent).toBe('Retrying1'));
        await userEvent.click(tab(el, 'Retrying'));
        const row = await rowNamed(el, 'nightly-build.zip');
        expect(row.textContent).toContain('Server answered 403 Forbidden');
        expect(row.textContent).toMatch(/Next try in \d+m/);
        await userEvent.click(rowButton(row, 'Try now'));
        await waitFor(() => expect(channel().callsTo('send_download_resume')[0]).toEqual([expect.any(String), false, expect.any(Number)]));
    },
};

/** H6: choosing a sub-folder of the download folder, listed by the agent. */
export const H6_ChooseFolder: Story = {
    name: 'H6 · Choose folder',
    render: () => standalone({ jobs: [], folders: { '': ['Downloads', 'movies', 'media', 'backups'], movies: ['2025', '2026'] } }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await userEvent.click(await waitForButton(el, 'Choose folder…'));
        const modal = await inShadow(el, '[aria-label="Save downloads to"]');
        await waitFor(() => expect(modal.querySelectorAll('.folder-row').length).toBe(4));
        await userEvent.click(Array.from(modal.querySelectorAll<HTMLButtonElement>('.folder-row')).find(b => b.textContent === 'movies')!);
        await waitFor(() => expect(channel().callsTo('send_download_folders').at(-1)?.[1]).toBe('movies'));
        await userEvent.click(await waitForButton(el, 'Save here'));
        await shadowText(el, `saving to ${DOWNLOAD_FOLDER}/movies`);
        typeInto(await inShadow<HTMLInputElement>(el, '#fetch-link'), 'https://example.org/a.iso');
        await userEvent.click(await waitForButton(el, 'Download'));
        await waitFor(() => expect(startArgs(channel().callsTo('send_download_start')).subDir).toBe('movies'));
    },
};
