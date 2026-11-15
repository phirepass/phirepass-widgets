import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{a as t,b as n,c as r,d as i,f as a,g as o,i as s,l as c,n as l,o as u,p as d,t as f,x as p}from"./helpers-Dt93J4_G.js";import{a as m,c as h,n as g,o as _,r as v}from"./fetch-helpers-aFemxpB-.js";var y,b,x,S,C,w,T,E,D,O,k,A,j,M;function N(){return(N=e((()=>{n(),v(),u(),{expect:y,userEvent:b,waitFor:x}=__STORYBOOK_MODULE_TEST__,S={title:`Remote Fetch/1 · Inside the SFTP browser`,parameters:{docs:{description:{component:"The Fetch button, its dialog and the transfers drawer: `<phirepass-downloader compact>` hosted by `<phirepass-sftp-client>`, sharing its channel."}}}},C={name:`A · Transfers drawer open`,render:()=>g({jobs:o(),live:!0}).root,play:async({canvasElement:e})=>{let{el:n}=r(e),i=await t(n,`.action.fetch`);await x(()=>y(i.querySelector(`.badge`)?.textContent).toBe(`3`));let a=await s(n);await b.click(await t(a,`.strip`)),await t(a,`.drawer`),await c(a,`big_buck_bunny_1080p.mp4`),await c(a,`Fetching metadata`),await c(a,`Server answered 403 Forbidden`);let o=f(n,`tr.part`);y(o.length).toBe(1)}},w={name:`A2 · Fetch dialog over the listing`,render:()=>g({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:n,channel:i}=r(e);await b.click(await t(n,`.action.fetch`));let a=await s(n),o=await t(a,`.modal`);y(o.textContent).toContain(`Fetch into this folder`),await x(()=>y(i().callsTo(`send_download_where`).at(-1)?.[1]).toEqual({service_id:`sftp-1`,path:d})),await x(()=>y(o.querySelector(`.dest`)?.textContent).toContain(d));let c=o.querySelector(`#fetch-link`);await b.type(c,`magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel.2010.1080p.mkv`),await x(()=>y(o.textContent).toContain(`How should it download?`));let l=Array.from(o.querySelectorAll(`button`)).find(e=>e.textContent===`Start download`);y(l.disabled).toBe(!0),await b.click(o.querySelector(`input[value="in"]`)),await x(()=>y(l.disabled).toBe(!1))}},T={name:`A3 · Drawer collapsed`,render:()=>g({jobs:o()}).root,play:async({canvasElement:e})=>{let{el:n}=r(e),i=await s(n),a=await t(i,`.strip`);await x(()=>y(a.textContent).toMatch(/3 active · \d+% · ↓ 14\.2 MB\/s/)),y(i.shadowRoot.querySelector(`.drawer`)).toBeNull()}},E={name:`C · Right-click a .torrent on the node`,render:()=>g({jobs:[]},{cwd:a}).root,play:async({canvasElement:e})=>{let{el:n,channel:o}=r(e);await c(n,`archlinux-2026.11.01-x86_64.iso.torrent`);let l=await s(n);await x(()=>y(o().callsTo(`send_download_subscribe`).length).toBe(1)),await x(async()=>y(await l.torrentPathFor(`${a}/x.torrent`)).toBe(`x.torrent`)),f(n,`tbody tr`).find(e=>e.textContent?.includes(`.torrent`)).dispatchEvent(new MouseEvent(`contextmenu`,{bubbles:!0,composed:!0,cancelable:!0,clientX:120,clientY:160}));let u=await t(n,`.context-menu`);y(u.textContent).toContain(`Download torrent contents here`),await b.click(await i(n,/Download torrent contents here/)),await x(()=>y(h(o().callsTo(`send_download_start`)).source).toEqual({TorrentPath:{path:`archlinux-2026.11.01-x86_64.iso.torrent`}}))}},D={name:`D · Download complete`,render:()=>g({jobs:[p({name:`home-assistant-backup.tar`,dest_root:d,state:`Downloading`,done_bytes:8e8,total_bytes:812e6,down_bps:2e7})],live:!0}).root,play:async({canvasElement:e})=>{let{el:n}=r(e),i=await s(n),a=await t(i,`[data-notice="completed"]`,5e3);y(a.textContent).toContain(`Download complete`),y(a.textContent).toContain(`home-assistant-backup.tar → ${d}`),await x(()=>y(f(n,`tr.fresh`).map(e=>e.textContent)).toEqual([y.stringContaining(`home-assistant-backup.tar`)]))}},O={name:`K3 · Deleting a file that is still downloading`,render:()=>g({jobs:o()}).root,play:async({canvasElement:e})=>{let{el:n,channel:a}=r(e),o=await s(n);await t(o,`.strip`),await l(n,`Delete big_buck_bunny_1080p.mp4.phirepass-part`);let c=await t(n,`[aria-label="This file is still downloading"]`);y(c.textContent).toContain(`deletes its download`),await b.click(await i(n,`Delete download`)),await x(()=>y(a().callsTo(`send_download_delete`).length).toBe(1)),y(a().callsTo(`send_sftp_remove`)).toEqual([])}},k={name:`X1 · Drawer with nothing in it`,render:()=>g({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:n}=r(e);await b.click(await t(n,`.action.fetch`));let a=await s(n);await b.click(await i(a,`Cancel`)),await c(a,`No downloads yet`)}},A={name:`G · Play a file from the listing`,render:()=>g({jobs:[]},{streams:!0}).root,play:async({canvasElement:e})=>{let{el:n,channel:i}=r(e);await l(n,`Play holiday-2025.mp4`),await x(()=>y(i().callsTo(`send_sftp_open_stream`)[0][2]).toBe(`${d}/holiday-2025.mp4`));let a=await t(n,`phirepass-media-player`);y(a.getAttribute(`src`)??a.src).toMatch(/\/api\/web\/stream\/.+\/t\/tok-mock$/)}},j={name:`G · Play while downloading, from the drawer`,render:()=>g({jobs:o()}).root,play:async({canvasElement:e})=>{let{el:n}=r(e),i=await s(n);await b.click(await t(i,`.strip`));let a=await _(i,`big_buck_bunny_1080p.mp4`);await b.click(m(a,`Play while downloading`));let o=await t(i,`phirepass-media-player`);y(o.src).toMatch(/\/api\/web\/stream\/[^/]+\/[^/]+\/0$/)}},M=[`A_TransfersDrawerOpen`,`A2_FetchDialog`,`A3_DrawerCollapsed`,`C_TorrentContextMenu`,`D_FinishedWhileElsewhere`,`K3_DeletePartFile`,`X1_EmptyDrawer`,`ListingPlay`,`RowPlay`],C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: 'A · Transfers drawer open',
  render: () => inSftp({
    jobs: drawerJobs(),
    live: true
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const fetch = await inShadow(el, '.action.fetch');
    await waitFor(() => expect(fetch.querySelector('.badge')?.textContent).toBe('3'));
    const dl = await hostedDownloader(el);
    await userEvent.click(await inShadow(dl, '.strip'));
    await inShadow(dl, '.drawer');
    await shadowText(dl, 'big_buck_bunny_1080p.mp4');
    await shadowText(dl, 'Fetching metadata');
    await shadowText(dl, 'Server answered 403 Forbidden');
    // The part file in the listing is dimmed.
    const part = allInShadow(el, 'tr.part');
    expect(part.length).toBe(1);
  }
}`,...C.parameters?.docs?.source},description:{story:`A: the drawer open under the listing, with a running link, a torrent, metadata, a finished and a retrying job.`,...C.parameters?.docs?.description}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: 'A2 · Fetch dialog over the listing',
  render: () => inSftp({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await userEvent.click(await inShadow(el, '.action.fetch'));
    const dl = await hostedDownloader(el);
    const modal = await inShadow(dl, '.modal');
    expect(modal.textContent).toContain('Fetch into this folder');
    await waitFor(() => expect(channel().callsTo('send_download_where').at(-1)?.[1]).toEqual({
      service_id: 'sftp-1',
      path: MEDIA_FOLDER
    }));
    await waitFor(() => expect(modal.querySelector('.dest')?.textContent).toContain(MEDIA_FOLDER));
    const input = modal.querySelector<HTMLInputElement>('#fetch-link')!;
    await userEvent.type(input, 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel.2010.1080p.mkv');
    await waitFor(() => expect(modal.textContent).toContain('How should it download?'));
    const start = Array.from(modal.querySelectorAll('button')).find(b => b.textContent === 'Start download')!;
    expect(start.disabled).toBe(true);
    await userEvent.click(modal.querySelector<HTMLInputElement>('input[value="in"]')!);
    await waitFor(() => expect(start.disabled).toBe(false));
  }
}`,...w.parameters?.docs?.source},description:{story:`A2: the Fetch dialog over the listing, saving into the folder on screen.`,...w.parameters?.docs?.description}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: 'A3 · Drawer collapsed',
  render: () => inSftp({
    jobs: drawerJobs()
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const dl = await hostedDownloader(el);
    const strip = await inShadow(dl, '.strip');
    await waitFor(() => expect(strip.textContent).toMatch(/3 active · \\d+% · ↓ 14\\.2 MB\\/s/));
    expect(dl.shadowRoot!.querySelector('.drawer')).toBeNull();
  }
}`,...T.parameters?.docs?.source},description:{story:`A3: the drawer collapsed to one line while you keep browsing.`,...T.parameters?.docs?.description}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: 'C · Right-click a .torrent on the node',
  render: () => inSftp({
    jobs: []
  }, {
    cwd: DOWNLOAD_FOLDER
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await shadowText(el, 'archlinux-2026.11.01-x86_64.iso.torrent');
    const dl = await hostedDownloader(el);
    await waitFor(() => expect(channel().callsTo('send_download_subscribe').length).toBe(1));
    await waitFor(async () => expect(await (dl as any).torrentPathFor(\`\${DOWNLOAD_FOLDER}/x.torrent\`)).toBe('x.torrent'));
    const row = allInShadow(el, 'tbody tr').find(r => r.textContent?.includes('.torrent'))!;
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      composed: true,
      cancelable: true,
      clientX: 120,
      clientY: 160
    }));
    const menu = await inShadow(el, '.context-menu');
    expect(menu.textContent).toContain('Download torrent contents here');
    await userEvent.click(await waitForButton(el, /Download torrent contents here/));
    await waitFor(() => expect(startArgs(channel().callsTo('send_download_start')).source).toEqual({
      TorrentPath: {
        path: 'archlinux-2026.11.01-x86_64.iso.torrent'
      }
    }));
  }
}`,...E.parameters?.docs?.source},description:{story:"C: right-click a `.torrent` that lies inside the download folder.",...E.parameters?.docs?.description}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: 'D · Download complete',
  render: () => inSftp({
    jobs: [job({
      name: 'home-assistant-backup.tar',
      dest_root: MEDIA_FOLDER,
      state: 'Downloading',
      done_bytes: 800_000_000,
      total_bytes: 812_000_000,
      down_bps: 20_000_000
    })],
    live: true
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const dl = await hostedDownloader(el);
    const toast = await inShadow(dl, '[data-notice="completed"]', 5000);
    expect(toast.textContent).toContain('Download complete');
    expect(toast.textContent).toContain(\`home-assistant-backup.tar → \${MEDIA_FOLDER}\`);
    await waitFor(() => expect(allInShadow(el, 'tr.fresh').map(r => r.textContent)).toEqual([expect.stringContaining('home-assistant-backup.tar')]));
  }
}`,...D.parameters?.docs?.source},description:{story:`D: a download finishes into the folder on screen: notice, refresh, and the file marked new.`,...D.parameters?.docs?.description}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: 'K3 · Deleting a file that is still downloading',
  render: () => inSftp({
    jobs: drawerJobs()
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    const dl = await hostedDownloader(el);
    await inShadow(dl, '.strip');
    await clickRowAction(el, 'Delete big_buck_bunny_1080p.mp4.phirepass-part');
    const dialog = await inShadow(el, '[aria-label="This file is still downloading"]');
    expect(dialog.textContent).toContain('deletes its download');
    await userEvent.click(await waitForButton(el, 'Delete download'));
    await waitFor(() => expect(channel().callsTo('send_download_delete').length).toBe(1));
    expect(channel().callsTo('send_sftp_remove')).toEqual([]);
  }
}`,...O.parameters?.docs?.source},description:{story:"K3: deleting a `.phirepass-part` that belongs to a running download deletes the download, not just the file.",...O.parameters?.docs?.description}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  name: 'X1 · Drawer with nothing in it',
  render: () => inSftp({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await userEvent.click(await inShadow(el, '.action.fetch'));
    const dl = await hostedDownloader(el);
    await userEvent.click(await waitForButton(dl, 'Cancel'));
    await shadowText(dl, 'No downloads yet');
  }
}`,...k.parameters?.docs?.source},description:{story:`X1: the drawer the first time Fetch is used.`,...k.parameters?.docs?.description}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  name: 'G · Play a file from the listing',
  render: () => inSftp({
    jobs: []
  }, {
    streams: true
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await clickRowAction(el, 'Play holiday-2025.mp4');
    await waitFor(() => expect(channel().callsTo('send_sftp_open_stream')[0][2]).toBe(\`\${MEDIA_FOLDER}/holiday-2025.mp4\`));
    const player = await inShadow(el, 'phirepass-media-player');
    expect(player.getAttribute('src') ?? (player as any).src).toMatch(/\\/api\\/web\\/stream\\/.+\\/t\\/tok-mock$/);
  }
}`,...A.parameters?.docs?.source},description:{story:`Play on a media file in the listing that is not a download (SFTPOp::OpenStream).`,...A.parameters?.docs?.description}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  name: 'G · Play while downloading, from the drawer',
  render: () => inSftp({
    jobs: drawerJobs()
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const dl = await hostedDownloader(el);
    await userEvent.click(await inShadow(dl, '.strip'));
    const row = await rowNamed(dl, 'big_buck_bunny_1080p.mp4');
    await userEvent.click(rowButton(row, 'Play while downloading'));
    const player = await inShadow(dl, 'phirepass-media-player');
    expect((player as any).src).toMatch(/\\/api\\/web\\/stream\\/[^/]+\\/[^/]+\\/0$/);
  }
}`,...j.parameters?.docs?.source},description:{story:`Rows of a running download keep their own Play.`,...j.parameters?.docs?.description}}}})))()}N();export{w as A2_FetchDialog,T as A3_DrawerCollapsed,C as A_TransfersDrawerOpen,E as C_TorrentContextMenu,D as D_FinishedWhileElsewhere,O as K3_DeletePartFile,A as ListingPlay,j as RowPlay,k as X1_EmptyDrawer,M as __namedExportsOrder,S as default};