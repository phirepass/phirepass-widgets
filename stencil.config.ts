import { Config } from '@stencil/core';

export const config: Config = {
    namespace: 'phirepass-widgets',
    // noVNC 1.7 is ESM-only and uses a top-level await (core/util/browser.js,
    // WebCodecs H.264 detection), which cannot be represented in the CommonJS
    // output target. Leaving it external keeps it out of the bundles entirely;
    // `phirepass-vnc` imports it dynamically, so it is only fetched when a VNC
    // session actually opens.
    rollupConfig: {
        inputOptions: {
            external: ['@novnc/novnc'],
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
