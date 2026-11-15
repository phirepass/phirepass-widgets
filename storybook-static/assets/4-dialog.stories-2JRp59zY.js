import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{a as t,b as n,c as r,h as i,o as a,p as o,u as s}from"./helpers-Dt93J4_G.js";import{c,i as l,r as u,t as d}from"./fetch-helpers-aFemxpB-.js";function f(e,t){return new File([new Uint8Array(t)],e,{type:`application/x-bittorrent`})}async function p(e,t){let n=e.querySelector(`input[type=file]`),r=new DataTransfer;r.items.add(t),n.files=r.files,n.dispatchEvent(new Event(`change`,{bubbles:!0}))}var m,h,g,_,v,y,b,x,S,C,w,T,E,D,O,k,A,j,M,N,P;function F(){return(F=e((()=>{n(),u(),a(),{expect:m,userEvent:h,waitFor:g}=__STORYBOOK_MODULE_TEST__,_={title:`Remote Fetch/4 · Every state of the Fetch dialog`,parameters:{docs:{description:{component:`Mockup B and its states. The same states apply to the standalone add form.`}}}},v=e=>Array.from(e.querySelectorAll(`button`)).find(e=>/Start download|Starting…/.test(e.textContent??``)),y=e=>e.querySelector(`#fetch-link`),b={name:`B · Fetch dialog, link`,render:()=>d({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=r(e),i=await l(t);await g(()=>m(i.querySelector(`.dest`)?.textContent).toContain(o)),s(y(i),`https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_1080p.mp4`),await g(()=>m(i.querySelector(`.detect`)?.textContent).toContain(`download.blender.org`)),m(i.querySelector(`#fetch-save-as`)).toBeTruthy(),m(i.querySelector(`#fetch-save-as`).placeholder).toBe(`big_buck_bunny_1080p.mp4`),m(i.textContent).not.toContain(`How should it download?`),await g(()=>m(v(i).disabled).toBe(!1)),await h.click(v(i)),await g(()=>m(c(n().callsTo(`send_download_start`))).toMatchObject({browsing:{service_id:`sftp-1`,path:o},inOrder:!0}))}},x={name:`B2 · A .torrent file chosen`,render:()=>d({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:n}=r(e);await p(await l(n),f(`archlinux-2026.11.01-x86_64.iso.torrent`,48e3));let i=await t(n,`.modal .filechip`);m(i.textContent).toContain(`archlinux-2026.11.01-x86_64.iso.torrent`),m(i.textContent).toContain(`48 KB · from this computer`),m(n.shadowRoot.querySelector(`#fetch-link`)).toBeNull(),await h.click(i.querySelector(`button`)),await g(()=>m(n.shadowRoot.querySelector(`#fetch-link`)).toBeTruthy())}},S={name:`B3 · Starting`,render:()=>d({jobs:[],onStart:`hang`}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);s(y(n),`https://download.blender.org/demo.mp4`),await g(()=>m(v(n).disabled).toBe(!1)),await h.click(v(n)),await g(()=>m(v(t.shadowRoot.querySelector(`.modal`)).textContent).toBe(`Starting…`)),m(v(t.shadowRoot.querySelector(`.modal`)).disabled).toBe(!0)}},C={name:`B4 · Not a link`,render:()=>d({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);await h.type(y(n),`ftp://old.example.org/file`),await g(()=>m(n.textContent).toContain(`Not a link`)),m(n.textContent).toContain(`Use http://, https:// or magnet:`),m(v(n).disabled).toBe(!0)}},w={name:`B5 · Magnet pasted, torrents are off`,render:()=>d({jobs:[],caps:i({torrents:!1})}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);m(n.querySelector(`.drop`)).toBeNull(),s(y(n),`magnet:?xt=urn:btih:9f2c0000000000000000000000000000000da41e`),await g(()=>m(n.textContent).toContain(`Torrents are off`)),m(v(n).disabled).toBe(!0)}},T={name:`B6 · .torrent file too large`,render:()=>d({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=r(e);await p(await l(t),f(`complete-archive.torrent`,34e5)),await g(()=>m(t.shadowRoot.querySelector(`.modal`).textContent).toContain(`Too large`)),m(t.shadowRoot.querySelector(`.filechip.bad`)).toBeTruthy(),m(v(t.shadowRoot.querySelector(`.modal`)).disabled).toBe(!0),m(n().callsTo(`send_download_start`)).toEqual([])}},E={name:`B7 · The node refused the address`,render:()=>d({jobs:[],onStart:`refuse`,refuseReason:`This node does not download from private network addresses.`}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);s(y(n),`http://192.168.1.10/backup.tar`),await g(()=>m(v(n).disabled).toBe(!1)),await h.click(v(n)),await g(()=>m(t.shadowRoot.querySelector(`.modal`)?.textContent).toContain(`This node does not download from private network addresses.`)),m(t.shadowRoot.querySelector(`.modal .note.err b`)?.textContent).toBe(`Refused`)}},D={name:`B8 · The node’s agent is too old`,render:()=>d({jobs:[],caps:i({agent_supported:!1})}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);await g(()=>m(n.querySelector(`[data-blocker="too-old"]`)).toBeTruthy()),m(n.textContent).toContain(`runs an agent that cannot download`),m(n.querySelector(`#fetch-link`)).toBeNull()}},O={name:`B9 · Downloads are off for this node`,render:()=>d({jobs:[],caps:i({http:!1,torrents:!1})}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=[];t.addEventListener(`phirepassOpenNodeSettings`,e=>n.push(e.detail));let i=await l(t);await g(()=>m(i.textContent).toContain(`Downloads are turned off for raspberrypi.`)),m(i.textContent).toContain(`You can turn them on in the node's settings.`),await h.click(Array.from(i.querySelectorAll(`button`)).find(e=>e.textContent===`Open node settings`)),m(n.length).toBe(1)}},k={name:`B9 · Downloads off, seen through a share`,render:()=>d({jobs:[],caps:i({http:!1,torrents:!1})},{props:{canConfigure:!1}}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);await g(()=>m(n.textContent).toContain(`Ask the node's owner to turn them on.`)),m(Array.from(n.querySelectorAll(`button`)).some(e=>e.textContent===`Open node settings`)).toBe(!1)}},A={name:`L3 · Fetch on a blocked node`,render:()=>d({jobs:[],caps:i({lock:`Organisation`})}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);await g(()=>m(n.textContent).toContain(`Your organisation does not allow downloads on raspberrypi.`)),m(n.textContent).toContain(`Organisation → Downloads`)}},j={name:`L3 · The download folder is missing`,render:()=>d({jobs:[],caps:i({lock:`NoFolder`})}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);await g(()=>m(n.textContent).toContain(`The download folder on this node is missing or can't be written.`))}},M={name:`A2 · Folder outside the download folder`,render:()=>d({jobs:[],where:()=>({saves_to:`/home/pi/Downloads`,mapped:!1})},{props:{browsingPath:`/etc`}}).root,play:async({canvasElement:e})=>{let{el:t}=r(e),n=await l(t);await g(()=>m(n.textContent).toContain(`This folder is outside raspberrypi's download folder. The file will be saved to /home/pi/Downloads.`))}},N={name:`U3 · A link that needs a login`,render:()=>d({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:n,channel:i}=r(e),a=await l(n);s(y(a),`https://git.example.com/releases/firmware-v2.4.bin`);let o;await g(()=>{o=Array.from(a.querySelectorAll(`button`)).find(e=>e.textContent?.includes(`This link needs a login`)),m(o).toBeTruthy()}),await h.click(o);let u=await t(n,`.modal .auth`);await h.click(Array.from(u.querySelectorAll(`label`)).find(e=>e.textContent===`Custom header`).querySelector(`input`));let d,f;await g(()=>{[d,f]=Array.from(n.shadowRoot.querySelectorAll(`.modal .auth .inp`)),m(f).toBeTruthy()}),s(d,`Host`),await g(()=>m(n.shadowRoot.querySelector(`.modal .hint.err`)?.textContent).toBe(`Host cannot be set here.`)),m(v(n.shadowRoot.querySelector(`.modal`)).disabled).toBe(!0),s(d,`X-Api-Key`),s(f,`secret`),await g(()=>m(v(n.shadowRoot.querySelector(`.modal`)).disabled).toBe(!1)),await h.click(v(n.shadowRoot.querySelector(`.modal`))),await g(()=>m(c(i().callsTo(`send_download_start`)).options.source_auth).toEqual({Header:{name:`X-Api-Key`,value:`secret`}}))}},P=[`B_FetchDialog`,`B2_TorrentFileChosen`,`B3_Starting`,`B4_NotALink`,`B5_TorrentsOff`,`B6_TorrentTooLarge`,`B7_NodeRefused`,`B8_AgentTooOld`,`B9_DownloadsOff`,`B9_DownloadsOffShared`,`L3_Blocked`,`L3_NoFolder`,`OutsideDownloadFolder`,`LinkLogin`],b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: 'B · Fetch dialog, link',
  render: () => embedded({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await waitFor(() => expect(modal.querySelector('.dest')?.textContent).toContain(MEDIA_FOLDER));
    typeInto(link(modal), 'https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_1080p.mp4');
    await waitFor(() => expect(modal.querySelector('.detect')?.textContent).toContain('download.blender.org'));
    expect(modal.querySelector('#fetch-save-as')).toBeTruthy();
    expect((modal.querySelector('#fetch-save-as') as HTMLInputElement).placeholder).toBe('big_buck_bunny_1080p.mp4');
    expect(modal.textContent).not.toContain('How should it download?');
    await waitFor(() => expect(startButton(modal).disabled).toBe(false));
    await userEvent.click(startButton(modal));
    await waitFor(() => expect(startArgs(channel().callsTo('send_download_start'))).toMatchObject({
      browsing: {
        service_id: 'sftp-1',
        path: MEDIA_FOLDER
      },
      inOrder: true
    }));
  }
}`,...b.parameters?.docs?.source},description:{story:`B: the resting state with a link. Save as shows for HTTP only.`,...b.parameters?.docs?.description}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: 'B2 · A .torrent file chosen',
  render: () => embedded({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await chooseFile(modal, fileOf('archlinux-2026.11.01-x86_64.iso.torrent', 48_000));
    const chip = await inShadow(el, '.modal .filechip');
    expect(chip.textContent).toContain('archlinux-2026.11.01-x86_64.iso.torrent');
    expect(chip.textContent).toContain('48 KB · from this computer');
    expect(el.shadowRoot!.querySelector('#fetch-link')).toBeNull();
    await userEvent.click(chip.querySelector('button')!);
    await waitFor(() => expect(el.shadowRoot!.querySelector('#fetch-link')).toBeTruthy());
  }
}`,...x.parameters?.docs?.source},description:{story:`B2: a .torrent chosen from this computer replaces the link field.`,...x.parameters?.docs?.description}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: 'B3 · Starting',
  render: () => embedded({
    jobs: [],
    onStart: 'hang'
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    typeInto(link(modal), 'https://download.blender.org/demo.mp4');
    await waitFor(() => expect(startButton(modal).disabled).toBe(false));
    await userEvent.click(startButton(modal));
    await waitFor(() => expect(startButton(el.shadowRoot!.querySelector('.modal')!).textContent).toBe('Starting…'));
    expect(startButton(el.shadowRoot!.querySelector('.modal')!).disabled).toBe(true);
  }
}`,...S.parameters?.docs?.source},description:{story:`B3: from the click until the node's first progress for the job.`,...S.parameters?.docs?.description}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: 'B4 · Not a link',
  render: () => embedded({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await userEvent.type(link(modal), 'ftp://old.example.org/file');
    await waitFor(() => expect(modal.textContent).toContain('Not a link'));
    expect(modal.textContent).toContain('Use http://, https:// or magnet:');
    expect(startButton(modal).disabled).toBe(true);
  }
}`,...C.parameters?.docs?.source},description:{story:`B4: not a link, checked as you type.`,...C.parameters?.docs?.description}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: 'B5 · Magnet pasted, torrents are off',
  render: () => embedded({
    jobs: [],
    caps: caps({
      torrents: false
    })
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    expect(modal.querySelector('.drop')).toBeNull();
    typeInto(link(modal), 'magnet:?xt=urn:btih:9f2c0000000000000000000000000000000da41e');
    await waitFor(() => expect(modal.textContent).toContain('Torrents are off'));
    expect(startButton(modal).disabled).toBe(true);
  }
}`,...w.parameters?.docs?.source},description:{story:`B5: a magnet on a node that allows links only. The .torrent picker is hidden too.`,...w.parameters?.docs?.description}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: 'B6 · .torrent file too large',
  render: () => embedded({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await chooseFile(modal, fileOf('complete-archive.torrent', 3_400_000));
    await waitFor(() => expect(el.shadowRoot!.querySelector('.modal')!.textContent).toContain('Too large'));
    expect(el.shadowRoot!.querySelector('.filechip.bad')).toBeTruthy();
    expect(startButton(el.shadowRoot!.querySelector('.modal')!).disabled).toBe(true);
    expect(channel().callsTo('send_download_start')).toEqual([]);
  }
}`,...T.parameters?.docs?.source},description:{story:`B6: a .torrent over 2 MB, refused before anything is sent.`,...T.parameters?.docs?.description}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: 'B7 · The node refused the address',
  render: () => embedded({
    jobs: [],
    onStart: 'refuse',
    refuseReason: 'This node does not download from private network addresses.'
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    typeInto(link(modal), 'http://192.168.1.10/backup.tar');
    await waitFor(() => expect(startButton(modal).disabled).toBe(false));
    await userEvent.click(startButton(modal));
    await waitFor(() => expect(el.shadowRoot!.querySelector('.modal')?.textContent).toContain('This node does not download from private network addresses.'));
    expect(el.shadowRoot!.querySelector('.modal .note.err b')?.textContent).toBe('Refused');
  }
}`,...E.parameters?.docs?.source},description:{story:`B7: the node refused the Start; shown in place while the dialog is open.`,...E.parameters?.docs?.description}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: 'B8 · The node’s agent is too old',
  render: () => embedded({
    jobs: [],
    caps: caps({
      agent_supported: false
    })
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await waitFor(() => expect(modal.querySelector('[data-blocker="too-old"]')).toBeTruthy());
    expect(modal.textContent).toContain('runs an agent that cannot download');
    expect(modal.querySelector('#fetch-link')).toBeNull();
  }
}`,...D.parameters?.docs?.source},description:{story:`B8: the node's agent predates Remote Fetch.`,...D.parameters?.docs?.description}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: 'B9 · Downloads are off for this node',
  render: () => embedded({
    jobs: [],
    caps: caps({
      http: false,
      torrents: false
    })
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const opened: unknown[] = [];
    el.addEventListener('phirepassOpenNodeSettings', e => opened.push((e as CustomEvent).detail));
    const modal = await openDialog(el);
    await waitFor(() => expect(modal.textContent).toContain('Downloads are turned off for raspberrypi.'));
    expect(modal.textContent).toContain("You can turn them on in the node's settings.");
    await userEvent.click(Array.from(modal.querySelectorAll('button')).find(b => b.textContent === 'Open node settings')!);
    expect(opened.length).toBe(1);
  }
}`,...O.parameters?.docs?.source},description:{story:`B9: Downloads are off for this node. The Fetch button stays so the feature can be found.`,...O.parameters?.docs?.description}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  name: 'B9 · Downloads off, seen through a share',
  render: () => embedded({
    jobs: [],
    caps: caps({
      http: false,
      torrents: false
    })
  }, {
    props: {
      canConfigure: false
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await waitFor(() => expect(modal.textContent).toContain("Ask the node's owner to turn them on."));
    expect(Array.from(modal.querySelectorAll('button')).some(b => b.textContent === 'Open node settings')).toBe(false);
  }
}`,...k.parameters?.docs?.source},description:{story:`B9 for someone the node is shared with: no settings button, different advice.`,...k.parameters?.docs?.description}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  name: 'L3 · Fetch on a blocked node',
  render: () => embedded({
    jobs: [],
    caps: caps({
      lock: 'Organisation'
    })
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await waitFor(() => expect(modal.textContent).toContain('Your organisation does not allow downloads on raspberrypi.'));
    expect(modal.textContent).toContain('Organisation → Downloads');
  }
}`,...A.parameters?.docs?.source},description:{story:`L3: the organisation blocks downloads on this node.`,...A.parameters?.docs?.description}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  name: 'L3 · The download folder is missing',
  render: () => embedded({
    jobs: [],
    caps: caps({
      lock: 'NoFolder'
    })
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await waitFor(() => expect(modal.textContent).toContain("The download folder on this node is missing or can't be written."));
  }
}`,...j.parameters?.docs?.source},description:{story:`L3, no folder: the download folder is missing or not writable.`,...j.parameters?.docs?.description}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  name: 'A2 · Folder outside the download folder',
  render: () => embedded({
    jobs: [],
    where: () => ({
      saves_to: '/home/pi/Downloads',
      mapped: false
    })
  }, {
    props: {
      browsingPath: '/etc'
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    await waitFor(() => expect(modal.textContent).toContain("This folder is outside raspberrypi's download folder. The file will be saved to /home/pi/Downloads."));
  }
}`,...M.parameters?.docs?.source},description:{story:`Outside the download folder: the dialog says where the file goes before Start.`,...M.parameters?.docs?.description}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  name: 'U3 · A link that needs a login',
  render: () => embedded({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    const modal = await openDialog(el);
    typeInto(link(modal), 'https://git.example.com/releases/firmware-v2.4.bin');
    let toggle: HTMLButtonElement | undefined;
    await waitFor(() => {
      toggle = Array.from(modal.querySelectorAll('button')).find(b => b.textContent?.includes('This link needs a login'));
      expect(toggle).toBeTruthy();
    });
    await userEvent.click(toggle!);
    const auth = await inShadow(el, '.modal .auth');
    await userEvent.click(Array.from(auth.querySelectorAll('label')).find(l => l.textContent === 'Custom header')!.querySelector('input')!);
    let nameInput!: HTMLInputElement;
    let valueInput!: HTMLInputElement;
    await waitFor(() => {
      [nameInput, valueInput] = Array.from(el.shadowRoot!.querySelectorAll<HTMLInputElement>('.modal .auth .inp'));
      expect(valueInput).toBeTruthy();
    });
    typeInto(nameInput, 'Host');
    await waitFor(() => expect(el.shadowRoot!.querySelector('.modal .hint.err')?.textContent).toBe('Host cannot be set here.'));
    expect(startButton(el.shadowRoot!.querySelector('.modal')!).disabled).toBe(true);
    typeInto(nameInput, 'X-Api-Key');
    typeInto(valueInput, 'secret');
    await waitFor(() => expect(startButton(el.shadowRoot!.querySelector('.modal')!).disabled).toBe(false));
    await userEvent.click(startButton(el.shadowRoot!.querySelector('.modal')!));
    await waitFor(() => expect(startArgs(channel().callsTo('send_download_start')).options.source_auth).toEqual({
      Header: {
        name: 'X-Api-Key',
        value: 'secret'
      }
    }));
  }
}`,...N.parameters?.docs?.source},description:{story:`U3 in the widget: a link that needs a login, collapsed under “This link needs a login”.`,...N.parameters?.docs?.description}}}})))()}F();export{x as B2_TorrentFileChosen,S as B3_Starting,C as B4_NotALink,w as B5_TorrentsOff,T as B6_TorrentTooLarge,E as B7_NodeRefused,D as B8_AgentTooOld,O as B9_DownloadsOff,k as B9_DownloadsOffShared,b as B_FetchDialog,A as L3_Blocked,j as L3_NoFolder,N as LinkLogin,M as OutsideDownloadFolder,P as __namedExportsOrder,_ as default};