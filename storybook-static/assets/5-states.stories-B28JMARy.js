import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{C as t,a as n,b as r,c as i,o as a,t as o,v as s}from"./helpers-Dt93J4_G.js";import{a as c,o as l,r as u,t as d}from"./fetch-helpers-aFemxpB-.js";async function f(e){await e.toggleDrawer(!0),await n(e,`.drawer .job`)}var p,m,h,g,_,v,y,b;function x(){return(x=e((()=>{r(),u(),a(),{expect:p,userEvent:m,waitFor:h}=__STORYBOOK_MODULE_TEST__,g={title:`Remote Fetch/5 · Every state of a download`,parameters:{docs:{description:{component:"One row per `FetchState`, with the buttons each state offers. Nothing is ever Failed."}}}},_=e=>Array.from(e.querySelectorAll(`.acts button`)).map(e=>e.getAttribute(`aria-label`)),v={name:`R · Every download state`,render:()=>d({jobs:s()},{height:900}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=i(e);await f(t),await h(()=>p(o(t,`.job`).length).toBe(10)),p((await l(t,`nightly-build-4412.zip`)).textContent).toContain(`Waiting for a free slot`),p((await l(t,`bbb_sunflower_1080p_60fps_normal.mp4`)).textContent).toContain(`Connecting`),p(_(await l(t,`big_buck_bunny_1080p.mp4`))).toEqual([`Play while downloading`,`Pause`,`Stop`]),p(_(await l(t,`Sintel.2010.1080p.mkv`))).toEqual([`Play while downloading`,`Pause`,`Stop`]);let r=await l(t,`ubuntu-26.04-desktop-amd64.iso`);p(_(r)).toEqual([`Pause`,`Stop`]),await m.click(c(r,`Switch to in order to watch`)),await h(()=>p(n().callsTo(`send_download_set_order`)[0].slice(1,2)).toEqual([!0])),await h(async()=>p(_(await l(t,`ubuntu-26.04-desktop-amd64.iso`))[0]).toBe(`Play while downloading`)),p(_(await l(t,`dataset-2026.tar.zst`))).toEqual([`Resume`,`Delete`]),p(_(await l(t,`nightly-build.zip`))).toEqual([`Try now`,`Stop`]),p(_(await l(t,`debian-13.2.0-amd64-netinst`))).toEqual([`Show in folder`,`Remove from list`]),p((await l(t,`old-iso.img`)).textContent).toContain(`Resume starts from zero`),await m.click(c(await l(t,`old-iso.img`),`Remove from list`)),await h(async()=>p((await l(t,`old-iso.img`)).dataset.state).toBe(`Deleting`)),await h(()=>p(o(t,`.job`).length).toBe(9)),p(t.shadowRoot.textContent).not.toMatch(/Failed/)}},y={name:`R2 · Torrent, schedule and disk states`,render:()=>d({jobs:t()},{height:640}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=i(e);await f(t),p((await l(t,`ubuntu-26.04-desktop-amd64.iso`)).textContent).toContain(`Checking downloaded pieces after a restart`);let r=await l(t,`debian-13.2.0-amd64-netinst`);p(r.textContent).toContain(`2.31 GB uploaded`),p(r.textContent).toContain(`seeding for 3d, until you delete it`);let a=await l(t,`dataset-2026.tar.zst`);p(a.textContent).toContain(`Waits for the download window`),await m.click(c(a,`Start now`)),await h(()=>p(n().callsTo(`send_download_resume`)[0].slice(1,2)).toEqual([!0]));let o=await l(t,`big_buck_bunny_1080p.mp4`);p(o.textContent).toContain(`Paused · disk almost full`),p(o.textContent).toContain(`1.6 GB free on /srv/downloads, the floor is 2 GB`),p(_(o)).not.toContain(`Start now`)}},b=[`R_EveryState`,`R2_TorrentScheduleDisk`],v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'R · Every download state',
  render: () => embedded({
    jobs: everyState()
  }, {
    height: 900
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
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
  }
}`,...v.parameters?.docs?.source},description:{story:`R: Queued, Connecting, Fetching metadata, Downloading (link, in order, fastest), Stopped, Retrying, Completed, Cancelled, Deleting.`,...v.parameters?.docs?.description}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'R2 · Torrent, schedule and disk states',
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
  }
}`,...y.parameters?.docs?.source},description:{story:`R2: Checking pieces, Seeding, Scheduled, Paused for the disk, and a link with a login.`,...y.parameters?.docs?.description}}}})))()}x();export{y as R2_TorrentScheduleDisk,v as R_EveryState,b as __namedExportsOrder,g as default};