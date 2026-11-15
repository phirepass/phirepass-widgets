import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{a as t,b as n,c as r,d as i,o as a,u as o,x as s}from"./helpers-Dt93J4_G.js";import{o as c,r as l,s as u}from"./fetch-helpers-aFemxpB-.js";async function d(e,n=g){o(await t(e,`#fetch-link`),n),await p.click(await i(e,`Download`))}var f,p,m,h,g,_,v,y,b,x,S,C;function w(){return(w=e((()=>{n(),l(),a(),{expect:f,userEvent:p,waitFor:m}=__STORYBOOK_MODULE_TEST__,h={title:`Remote Fetch/9 · Notices`,parameters:{docs:{description:{component:`Small notices at the bottom of the widget. Only “still retrying after a day” stays until dismissed.`}}}},g=`https://releases.ubuntu.com/26.04/ubuntu-26.04-desktop-amd64.iso`,_=(e,n)=>t(e,`.toast[data-notice="${n}"]`,4e3),v={name:`N1 · Download started`,render:()=>u({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:t}=r(e);await d(t);let n=await _(t,`started`);f(n.textContent).toContain(`Download started`),f(n.textContent).toContain(`ubuntu-26.04-desktop-amd64.iso → /home/pi/Downloads`),await p.click(n.querySelector(`[aria-label="Dismiss"]`)),await m(()=>f(t.shadowRoot.querySelector(`.toast`)).toBeNull())}},y={name:`N2 · Added to the queue`,render:()=>u({jobs:[s({name:`Sintel.2010.1080p.mkv`,state:`Downloading`,done_bytes:3e8,total_bytes:112e7})],onStart:`queued`}).root,play:async({canvasElement:e})=>{let{el:t}=r(e);await d(t);let n=await _(t,`queued`);f(n.textContent).toContain(`Added to the queue`),f(n.textContent).toContain(`1 download is already running on this node`)}},b={name:`N3 · Still retrying after a day`,render:()=>u({jobs:[s({download_id:`dl-retry`,name:`nightly-build.zip`,state:`Retrying`,retry_reason:`Server answered 403 Forbidden`,attempt:31})]}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=r(e);await m(()=>f(t.shadowRoot.querySelector(`[role=tab]`)).toBeTruthy()),n().update(`dl-retry`,{attempt:40,next_attempt_at:Date.now()+36e5});let i=await _(t,`stuck`);f(i.textContent).toContain(`nightly-build.zip · Server answered 403 Forbidden`),f(i.classList.contains(`bad`)).toBe(!0),n().update(`dl-retry`,{attempt:41}),await new Promise(e=>setTimeout(e,200)),f(t.shadowRoot.querySelectorAll(`.toast[data-notice="stuck"]`).length).toBe(1)}},x={name:`N4 · Saved under another name`,render:()=>u({jobs:[],savedAs:`report (1).pdf`}).root,play:async({canvasElement:e})=>{let{el:t}=r(e);await d(t,`https://example.com/files/report.pdf`);let n=await _(t,`renamed`);f(n.textContent).toContain(`Saved as report (1).pdf`),f(n.textContent).toContain(`A file named report.pdf was already in /home/pi/Downloads`)}},S={name:`D · Download complete`,render:()=>u({jobs:[s({download_id:`dl-done`,name:`home-assistant-backup.tar`,state:`Downloading`,done_bytes:8e8,total_bytes:812e6})]}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=r(e),a=[],o=[];t.addEventListener(`phirepassFetchCompleted`,e=>a.push(e.detail)),t.addEventListener(`phirepassShowInFolder`,e=>o.push(e.detail)),await c(t,`home-assistant-backup.tar`),n().update(`dl-done`,{state:`Completed`,done_bytes:812e6,finished_at:Date.now()});let s=await _(t,`completed`);f(s.textContent).toContain(`home-assistant-backup.tar → /home/pi/Downloads`),f(a).toHaveLength(1),await p.click(await i(t,`Show`)),f(o[0]).toEqual({path:`/home/pi/Downloads`,name:`home-assistant-backup.tar`}),n().update(`dl-done`,{up_total:0}),await new Promise(e=>setTimeout(e,200)),f(a).toHaveLength(1)}},C=[`N1_Started`,`N2_Queued`,`N3_StillRetrying`,`N4_Renamed`,`D_Completed`],v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'N1 · Download started',
  render: () => standalone({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await start(el);
    const toast = await notice(el, 'started');
    expect(toast.textContent).toContain('Download started');
    expect(toast.textContent).toContain('ubuntu-26.04-desktop-amd64.iso → /home/pi/Downloads');
    await userEvent.click(toast.querySelector<HTMLButtonElement>('[aria-label="Dismiss"]')!);
    await waitFor(() => expect(el.shadowRoot!.querySelector('.toast')).toBeNull());
  }
}`,...v.parameters?.docs?.source},description:{story:`N1: the node took it.`,...v.parameters?.docs?.description}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'N2 · Added to the queue',
  render: () => standalone({
    jobs: [job({
      name: 'Sintel.2010.1080p.mkv',
      state: 'Downloading',
      done_bytes: 300_000_000,
      total_bytes: 1_120_000_000
    })],
    onStart: 'queued'
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await start(el);
    const toast = await notice(el, 'queued');
    expect(toast.textContent).toContain('Added to the queue');
    expect(toast.textContent).toContain('1 download is already running on this node');
  }
}`,...y.parameters?.docs?.source},description:{story:`N2: the node has every slot busy.`,...y.parameters?.docs?.description}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: 'N3 · Still retrying after a day',
  render: () => standalone({
    jobs: [job({
      download_id: 'dl-retry',
      name: 'nightly-build.zip',
      state: 'Retrying',
      retry_reason: 'Server answered 403 Forbidden',
      attempt: 31
    })]
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await waitFor(() => expect(el.shadowRoot!.querySelector('[role=tab]')).toBeTruthy());
    channel().update('dl-retry', {
      attempt: 40,
      next_attempt_at: Date.now() + 3_600_000
    });
    const toast = await notice(el, 'stuck');
    expect(toast.textContent).toContain('nightly-build.zip · Server answered 403 Forbidden');
    expect(toast.classList.contains('bad')).toBe(true);
    // A later progress frame does not raise it twice.
    channel().update('dl-retry', {
      attempt: 41
    });
    await new Promise(r => setTimeout(r, 200));
    expect(el.shadowRoot!.querySelectorAll('.toast[data-notice="stuck"]').length).toBe(1);
  }
}`,...b.parameters?.docs?.source},description:{story:`N3: retrying for a day; sticky, with a way to the row.`,...b.parameters?.docs?.description}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: 'N4 · Saved under another name',
  render: () => standalone({
    jobs: [],
    savedAs: 'report (1).pdf'
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await start(el, 'https://example.com/files/report.pdf');
    const toast = await notice(el, 'renamed');
    expect(toast.textContent).toContain('Saved as report (1).pdf');
    expect(toast.textContent).toContain('A file named report.pdf was already in /home/pi/Downloads');
  }
}`,...x.parameters?.docs?.source},description:{story:`N4: a file with that name was already there.`,...x.parameters?.docs?.description}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: 'D · Download complete',
  render: () => standalone({
    jobs: [job({
      download_id: 'dl-done',
      name: 'home-assistant-backup.tar',
      state: 'Downloading',
      done_bytes: 800_000_000,
      total_bytes: 812_000_000
    })]
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    const completed: any[] = [];
    const shown: any[] = [];
    el.addEventListener('phirepassFetchCompleted', e => completed.push((e as CustomEvent).detail));
    el.addEventListener('phirepassShowInFolder', e => shown.push((e as CustomEvent).detail));
    await rowNamed(el, 'home-assistant-backup.tar');
    channel().update('dl-done', {
      state: 'Completed',
      done_bytes: 812_000_000,
      finished_at: Date.now()
    });
    const toast = await notice(el, 'completed');
    expect(toast.textContent).toContain('home-assistant-backup.tar → /home/pi/Downloads');
    expect(completed).toHaveLength(1);
    await userEvent.click(await waitForButton(el, 'Show'));
    expect(shown[0]).toEqual({
      path: '/home/pi/Downloads',
      name: 'home-assistant-backup.tar'
    });
    // Another frame for the same finished job does not repeat it.
    channel().update('dl-done', {
      up_total: 0
    });
    await new Promise(r => setTimeout(r, 200));
    expect(completed).toHaveLength(1);
  }
}`,...S.parameters?.docs?.source},description:{story:`D: a download finished while the page was open.`,...S.parameters?.docs?.description}}}})))()}w();export{S as D_Completed,v as N1_Started,y as N2_Queued,b as N3_StillRetrying,x as N4_Renamed,C as __namedExportsOrder,h as default};