import { Config } from '@stencil/core';

export const config: Config = {
    namespace: 'phirepass-widgets',
    // IronRDP ships as ESM only and embeds a ~4.5 MB wasm payload as a data
    // URI, which both bloats and breaks the CommonJS output target. Leaving the
    // packages external keeps them out of the bundles entirely; `phirepass-rdp`
    // imports them dynamically, so they are only fetched when an RDP session
    // actually opens.
    rollupConfig: {
        inputOptions: {
            external: ['@devolutions/iron-remote-desktop', '@devolutions/iron-remote-desktop-rdp'],
        },
    },
    outputTargets: [
        {
            type: 'dist',
            esmLoaderPath: '../loader',
            copy: [
                {
                    src: '../node_modules/phirepass-channel/phirepass-channel_bg.wasm',
                    dest: 'phirepass-channel_bg.wasm',
                },
            ],
        },
        {
            type: 'dist-custom-elements',
            customElementsExportBehavior: 'auto-define-custom-elements',
            externalRuntime: false,
        },
        {
            type: 'docs-readme',
        },
        {
            type: 'www',
            serviceWorker: null, // disable service workers
            copy: [
                {
                    src: '../node_modules/@xterm/xterm/css/xterm.css',
                    dest: '../src/components/phirepass-terminal/xterm.css',
                },
                {
                    src: '../node_modules/phirepass-channel/phirepass-channel_bg.wasm',
                    dest: '../www/build/phirepass-channel_bg.wasm',
                },
            ],
        },
    ],
    testing: {
        browserHeadless: 'shell',
    },
};
