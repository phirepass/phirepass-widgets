import type { Preview } from '@storybook/web-components-vite';

// Each module defines its own element on import (`auto-define-custom-elements`);
// `dist/components/index.js` only re-exports the runtime, so import them one by one.
import '../dist/components/phirepass-terminal.js';
import '../dist/components/phirepass-sftp-client.js';
import '../dist/components/phirepass-rdp.js';
import '../dist/components/phirepass-downloader.js';
import '../dist/components/phirepass-media-player.js';

const preview: Preview = {
    parameters: {
        layout: 'padded',
        backgrounds: {
            options: {
                page: { name: 'Page', value: '#0b0e11' },
                light: { name: 'Light', value: '#f6f7f6' },
            },
        },
        controls: { expanded: true },
        a11y: {
            // Report, don't fail: the widgets' palette is reviewed separately.
            test: 'todo',
        },
    },
    initialGlobals: {
        backgrounds: { value: 'page' },
    },
    tags: ['autodocs'],
};

export default preview;
