import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { embedded, standalone } from '../fetch-helpers';
import { mount, mounted, shadowText, waitForButton } from '../helpers';

const meta: Meta = {
    title: 'Remote Fetch/7 · Empty, unavailable and error screens',
};
export default meta;

type Story = StoryObj;

/** X1 (embedded): see group 1. This is the drawer on its own. */
export const X1_EmptyDrawer: Story = {
    name: 'X1 · Drawer with nothing in it',
    render: () => embedded({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await (el as any).toggleDrawer(true);
        await shadowText(el, 'No downloads yet');
        await shadowText(el, 'Downloads keep running after you close this tab');
    },
};

/** X2: standalone, first open on a node with Downloads on. */
export const X2_StandaloneFirstUse: Story = {
    name: 'X2 · Standalone, first use',
    render: () => standalone({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await shadowText(el, 'Nothing downloading');
        await shadowText(el, 'It downloads onto raspberrypi, into /home/pi/Downloads.');
    },
};

/** X3: no valid session. */
export const X3_NotSignedIn: Story = {
    name: 'X3 · Standalone, not signed in',
    render: () => standalone({ jobs: [] }, { mock: { auth: 'fail' } }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const signIn: unknown[] = [];
        el.addEventListener('phirepassSignIn', () => signIn.push(1));
        await shadowText(el, 'Sign in to PhirePass');
        await userEvent.click(await waitForButton(el, 'Sign in'));
        expect(signIn.length).toBe(1);
    },
};

/** X3 without a token at all. */
export const X3_NoToken: Story = {
    name: 'X3 · Standalone, no token',
    render: () => standalone({ jobs: [] }, { props: { token: undefined } }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await shadowText(el, 'Your downloads are tied to your account');
    },
};

/** X4: the node (or server) cannot be reached; Try again reconnects. */
export const X4_Unreachable: Story = {
    name: 'X4 · Node cannot be reached',
    render: () => standalone({ jobs: [] }, { mock: { connect: 'refuse' } }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await shadowText(el, "Can't reach raspberrypi");
        await shadowText(el, 'its downloads carry on');
        const first = channel();
        await userEvent.click(await waitForButton(el, 'Try again'));
        await waitFor(() => expect(channel()).not.toBe(first));
    },
};

/** A page whose channel predates Remote Fetch. */
export const OldChannel: Story = {
    name: 'Channel without Remote Fetch',
    render: () => mount('phirepass-downloader', { nodeLabel: 'raspberrypi' }, {}, { height: 300 }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await shadowText(el, 'Downloads are not available here');
    },
};
