import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{C as t,a as n,b as r,c as i,d as a,o,u as s,v as c,x as l,y as u}from"./helpers-Dt93J4_G.js";import{a as d,i as f,o as p,r as m,s as h,t as g}from"./fetch-helpers-aFemxpB-.js";async function _(e){await e.toggleDrawer(!0),await n(e,`.drawer .job`)}var v,y,b,x,S,C,w,T,E,D,O;function k(){return(k=e((()=>{r(),m(),o(),{expect:v,userEvent:y,waitFor:b}=__STORYBOOK_MODULE_TEST__,x={title:`Remote Fetch/6 · Confirmations`,parameters:{docs:{description:{component:`Only actions that destroy data, stop playback or expose the node ask first.`}}}},S={name:`K1 · Stop a download`,render:()=>g({jobs:c()},{height:640}).root,play:async({canvasElement:e})=>{let{el:t,channel:r}=i(e);await _(t),await y.click(d(await p(t,`big_buck_bunny_1080p.mp4`),`Stop`));let o=await n(t,`[aria-label="Stop this download?"]`);v(o.textContent).toContain(`356 MB of 920 MB downloaded`),await y.click(o.querySelector(`input[type=checkbox]`)),await y.click(await a(t,`Stop download`)),await b(()=>v(r().callsTo(`send_download_stop`)[0].slice(1,2)).toEqual([!0])),await b(async()=>v((await p(t,`big_buck_bunny_1080p.mp4`)).dataset.state).toBe(`Cancelled`))}},C={name:`K8 · Delete a download`,render:()=>g({jobs:t()},{height:640}).root,play:async({canvasElement:e})=>{let{el:t,channel:r}=i(e);await _(t),await y.click(d(await p(t,`debian-13.2.0-amd64-netinst`),`Delete`));let o=await n(t,`[aria-label="Delete this download?"]`);v(o.textContent).toContain(`raspberrypi stops sharing it with peers.`),v(o.textContent).toContain(`Also delete the files`),await y.click(await a(t,`Delete`)),await b(()=>v(r().callsTo(`send_download_delete`)[0].slice(1,2)).toEqual([!1]))}},w={name:`K8 · Delete an unfinished download`,render:()=>h({jobs:[l({name:`dataset-2026.tar.zst`,state:`Stopped`,done_bytes:38e6,total_bytes:1e8})]}).root,play:async({canvasElement:e})=>{let{el:t}=i(e);await y.click(d(await p(t,`dataset-2026.tar.zst`),`Delete`));let r=await n(t,`[aria-label="Delete this download?"]`);v(r.textContent).toContain(`The part already downloaded is deleted.`),v(r.querySelector(`input[type=checkbox]`)).toBeNull()}},T={name:`K9 · Switch to fastest while playing`,render:()=>g({jobs:c()},{height:720}).root,play:async({canvasElement:e})=>{let{el:t,channel:r}=i(e);await _(t);let o=await p(t,`Sintel.2010.1080p.mkv`);await y.click(d(o,`Play while downloading`)),await n(t,`phirepass-media-player`),await y.click(d(await p(t,`Sintel.2010.1080p.mkv`),`Switch to fastest`));let s=await n(t,`[aria-label="Switch to fastest?"]`);v(s.textContent).toContain(`Sintel.2010.1080p.mkv is playing.`),await y.click(await a(t,`Switch and stop playback`)),await b(()=>v(r().callsTo(`send_download_set_order`)[0].slice(1,2)).toEqual([!1])),await b(()=>v(t.shadowRoot.querySelector(`phirepass-media-player`)).toBeNull())}},E={name:`K2 · First torrent on this browser`,render:()=>{try{localStorage.removeItem(`phirepass.downloader.torrent-ack`)}catch{}return g({jobs:[]}).root},play:async({canvasElement:e})=>{let{el:t,channel:r}=i(e),o=await f(t);s(o.querySelector(`#fetch-link`),`magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel`),await y.click(await b(()=>{let e=o.querySelector(`input[value="fast"]`);return v(e).toBeTruthy(),e})),await y.click(await a(t,`Start download`));let c=await n(t,`[aria-label="Start a torrent on raspberrypi?"]`);v(c.textContent).toContain(`They can see its internet address`),v(c.textContent).toContain(`keeps sharing it with other peers until you delete it`),v(r().callsTo(`send_download_start`)).toEqual([]),await y.click(await a(t,`Start torrent`)),await b(()=>v(r().callsTo(`send_download_start`).length).toBe(1))}},D={name:`K5 · Not enough space`,render:()=>h({jobs:u().slice(0,1),onStart:`refuse`,refuseReason:`This download needs 6.05 GB. /home/pi/Downloads has 4.2 GB free.`}).root,play:async({canvasElement:e})=>{let{el:t}=i(e);s(await n(t,`#fetch-link`),`https://releases.ubuntu.com/26.04/ubuntu-26.04-desktop-amd64.iso`),await y.click(await a(t,`Download`));let r=await n(t,`[aria-label="Not enough space"]`);v(r.textContent).toContain(`This download needs 6.05 GB. /home/pi/Downloads has 4.2 GB free.`),await y.click(await a(t,`OK`)),await b(()=>v(t.shadowRoot.querySelector(`[aria-label="Not enough space"]`)).toBeNull())}},O=[`K1_StopDownload`,`K8_DeleteDownload`,`K8_DeleteUnfinished`,`K9_SwitchToFastestWhilePlaying`,`K2_FirstTorrent`,`K5_NotEnoughSpace`],S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: 'K1 · Stop a download',
  render: () => embedded({
    jobs: everyState()
  }, {
    height: 640
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await drawer(el);
    await userEvent.click(rowButton(await rowNamed(el, 'big_buck_bunny_1080p.mp4'), 'Stop'));
    const dialog = await inShadow(el, '[aria-label="Stop this download?"]');
    expect(dialog.textContent).toContain('356 MB of 920 MB downloaded');
    await userEvent.click(dialog.querySelector('input[type=checkbox]')!);
    await userEvent.click(await waitForButton(el, 'Stop download'));
    await waitFor(() => expect(channel().callsTo('send_download_stop')[0].slice(1, 2)).toEqual([true]));
    await waitFor(async () => expect((await rowNamed(el, 'big_buck_bunny_1080p.mp4')).dataset.state).toBe('Cancelled'));
  }
}`,...S.parameters?.docs?.source},description:{story:`K1: ✕ on an unfinished row. Unticked the row is Stopped; ticked it is Cancelled.`,...S.parameters?.docs?.description}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: 'K8 · Delete a download',
  render: () => embedded({
    jobs: moreStates()
  }, {
    height: 640
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await drawer(el);
    await userEvent.click(rowButton(await rowNamed(el, 'debian-13.2.0-amd64-netinst'), 'Delete'));
    const dialog = await inShadow(el, '[aria-label="Delete this download?"]');
    expect(dialog.textContent).toContain('raspberrypi stops sharing it with peers.');
    expect(dialog.textContent).toContain('Also delete the files');
    await userEvent.click(await waitForButton(el, 'Delete'));
    await waitFor(() => expect(channel().callsTo('send_download_delete')[0].slice(1, 2)).toEqual([false]));
  }
}`,...C.parameters?.docs?.source},description:{story:`K8: Delete on a seeding torrent: it stops sharing; the files stay unless asked.`,...C.parameters?.docs?.description}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: 'K8 · Delete an unfinished download',
  render: () => standalone({
    jobs: [job({
      name: 'dataset-2026.tar.zst',
      state: 'Stopped',
      done_bytes: 38_000_000,
      total_bytes: 100_000_000
    })]
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await userEvent.click(rowButton(await rowNamed(el, 'dataset-2026.tar.zst'), 'Delete'));
    const dialog = await inShadow(el, '[aria-label="Delete this download?"]');
    expect(dialog.textContent).toContain('The part already downloaded is deleted.');
    expect(dialog.querySelector('input[type=checkbox]')).toBeNull();
  }
}`,...w.parameters?.docs?.source},description:{story:`K8 on a stopped download: its part is deleted with it, so there is no box.`,...w.parameters?.docs?.description}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: 'K9 · Switch to fastest while playing',
  render: () => embedded({
    jobs: everyState()
  }, {
    height: 720
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
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
  }
}`,...T.parameters?.docs?.source},description:{story:`K9: switching a torrent that is playing to Fastest asks first.`,...T.parameters?.docs?.description}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: 'K2 · First torrent on this browser',
  render: () => {
    try {
      localStorage.removeItem('phirepass.downloader.torrent-ack');
    } catch {
      // storage may be unavailable
    }
    return embedded({
      jobs: []
    }).root;
  },
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
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
  }
}`,...E.parameters?.docs?.source},description:{story:`K2: before the first torrent on this browser.`,...E.parameters?.docs?.description}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: 'K5 · Not enough space',
  render: () => standalone({
    jobs: finishedJobs().slice(0, 1),
    onStart: 'refuse',
    refuseReason: 'This download needs 6.05 GB. /home/pi/Downloads has 4.2 GB free.'
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    typeInto(await inShadow<HTMLInputElement>(el, '#fetch-link'), 'https://releases.ubuntu.com/26.04/ubuntu-26.04-desktop-amd64.iso');
    await userEvent.click(await waitForButton(el, 'Download'));
    const dialog = await inShadow(el, '[aria-label="Not enough space"]');
    expect(dialog.textContent).toContain('This download needs 6.05 GB. /home/pi/Downloads has 4.2 GB free.');
    await userEvent.click(await waitForButton(el, 'OK'));
    await waitFor(() => expect(el.shadowRoot!.querySelector('[aria-label="Not enough space"]')).toBeNull());
  }
}`,...D.parameters?.docs?.source},description:{story:`K5: the node refused a Start that would not fit. A notice, not a question.`,...D.parameters?.docs?.description}}}})))()}k();export{S as K1_StopDownload,E as K2_FirstTorrent,D as K5_NotEnoughSpace,C as K8_DeleteDownload,w as K8_DeleteUnfinished,T as K9_SwitchToFastestWhilePlaying,O as __namedExportsOrder,x as default};