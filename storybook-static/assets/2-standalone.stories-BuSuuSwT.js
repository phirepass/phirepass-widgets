import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{a as t,b as n,c as r,d as i,f as a,l as o,o as s,t as c,u as l,w as u,y as d}from"./helpers-Dt93J4_G.js";import{a as f,c as p,o as m,r as h,s as g}from"./fetch-helpers-aFemxpB-.js";var _,v,y,b,x,S,C,w,T,E,D;function O(){return(O=e((()=>{n(),h(),s(),{expect:_,userEvent:v,waitFor:y}=__STORYBOOK_MODULE_TEST__,b={title:`Remote Fetch/2 · The downloader on its own`,parameters:{docs:{description:{component:"`<phirepass-downloader node-id token>` with no SFTP client around it: its own page, an installed app, or the node card’s Downloads button."}}}},x=(e,t)=>c(e,`[role=tab]`).find(e=>e.textContent?.startsWith(t)),S={name:`H · Desktop`,render:()=>g({jobs:u(),folders:{"":[`movies`,`backups`]}}).root,play:async({canvasElement:e})=>{let{el:n,channel:s}=r(e);await o(n,`saving to ${a}`),await y(()=>_(x(n,`Active`).textContent).toBe(`Active2`)),_(x(n,`Finished`).textContent).toBe(`Finished3`),_(x(n,`Retrying`).textContent).toBe(`Retrying1`),await o(n,`Sintel.2010.1080p.mkv`),l(await t(n,`#fetch-link`),`https://downloads.raspberrypi.com/raspios.img.xz`),await v.click(await i(n,`Download`)),await y(()=>_(p(s().callsTo(`send_download_start`))).toMatchObject({subDir:null,browsing:null,inOrder:!0}))}},C={name:`H3 · Phone`,render:()=>g({jobs:u()},{width:360,height:640}).root,parameters:{viewport:{defaultViewport:`mobile1`}},play:async({canvasElement:e})=>{let{el:t}=r(e);await o(t,`raspios-bookworm-arm64-lite.img.xz`),_(t.getBoundingClientRect().width).toBeLessThanOrEqual(360),_(t.scrollWidth).toBeLessThanOrEqual(t.clientWidth+1)}},w={name:`H4 · Finished tab`,render:()=>g({jobs:d()}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=r(e);await y(()=>_(x(t,`Finished`)).toBeTruthy()),await v.click(x(t,`Finished`)),await o(t,`5 finished`),await v.click(await i(t,`Clear finished`)),await y(()=>_(n().callsTo(`send_download_delete`).length).toBe(4)),_(n().callsTo(`send_download_delete`).every(e=>e[1]===!1)).toBe(!0),await y(()=>_(c(t,`.job`).length).toBe(1)),await o(t,`Seeding`)}},T={name:`H5 · Retrying tab`,render:()=>g({jobs:u()}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=r(e);await y(()=>_(x(t,`Retrying`).textContent).toBe(`Retrying1`)),await v.click(x(t,`Retrying`));let i=await m(t,`nightly-build.zip`);_(i.textContent).toContain(`Server answered 403 Forbidden`),_(i.textContent).toMatch(/Next try in \d+m/),await v.click(f(i,`Try now`)),await y(()=>_(n().callsTo(`send_download_resume`)[0]).toEqual([_.any(String),!1,_.any(Number)]))}},E={name:`H6 · Choose folder`,render:()=>g({jobs:[],folders:{"":[`Downloads`,`movies`,`media`,`backups`],movies:[`2025`,`2026`]}}).root,play:async({canvasElement:e})=>{let{el:n,channel:s}=r(e);await v.click(await i(n,`Choose folder…`));let c=await t(n,`[aria-label="Save downloads to"]`);await y(()=>_(c.querySelectorAll(`.folder-row`).length).toBe(4)),await v.click(Array.from(c.querySelectorAll(`.folder-row`)).find(e=>e.textContent===`movies`)),await y(()=>_(s().callsTo(`send_download_folders`).at(-1)?.[1]).toBe(`movies`)),await v.click(await i(n,`Save here`)),await o(n,`saving to ${a}/movies`),l(await t(n,`#fetch-link`),`https://example.org/a.iso`),await v.click(await i(n,`Download`)),await y(()=>_(p(s().callsTo(`send_download_start`)).subDir).toBe(`movies`))}},D=[`H_Desktop`,`H3_Phone`,`H4_FinishedTab`,`H5_RetryingTab`,`H6_ChooseFolder`],S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: 'H · Desktop',
  render: () => standalone({
    jobs: standaloneJobs(),
    folders: {
      '': ['movies', 'backups']
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await shadowText(el, \`saving to \${DOWNLOAD_FOLDER}\`);
    await waitFor(() => expect(tab(el, 'Active').textContent).toBe('Active2'));
    expect(tab(el, 'Finished').textContent).toBe('Finished3');
    expect(tab(el, 'Retrying').textContent).toBe('Retrying1');
    await shadowText(el, 'Sintel.2010.1080p.mkv');
    // Starting a link sends no browsing target: it saves into the download folder.
    typeInto(await inShadow<HTMLInputElement>(el, '#fetch-link'), 'https://downloads.raspberrypi.com/raspios.img.xz');
    await userEvent.click(await waitForButton(el, 'Download'));
    await waitFor(() => expect(startArgs(channel().callsTo('send_download_start'))).toMatchObject({
      subDir: null,
      browsing: null,
      inOrder: true
    }));
  }
}`,...S.parameters?.docs?.source},description:{story:`H: desktop. Saves to the download folder, with tabs because it is the whole screen.`,...S.parameters?.docs?.description}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: 'H3 · Phone',
  render: () => standalone({
    jobs: standaloneJobs()
  }, {
    width: 360,
    height: 640
  }).root,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  },
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await shadowText(el, 'raspios-bookworm-arm64-lite.img.xz');
    expect(el.getBoundingClientRect().width).toBeLessThanOrEqual(360);
    // No horizontal scroll inside the widget.
    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth + 1);
  }
}`,...C.parameters?.docs?.source},description:{story:`H3: the same widget at phone width.`,...C.parameters?.docs?.description}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: 'H4 · Finished tab',
  render: () => standalone({
    jobs: finishedJobs()
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await waitFor(() => expect(tab(el, 'Finished')).toBeTruthy());
    await userEvent.click(tab(el, 'Finished'));
    await shadowText(el, '5 finished');
    await userEvent.click(await waitForButton(el, 'Clear finished'));
    await waitFor(() => expect(channel().callsTo('send_download_delete').length).toBe(4));
    expect(channel().callsTo('send_download_delete').every(c => c[1] === false)).toBe(true);
    await waitFor(() => expect(allInShadow(el, '.job').length).toBe(1));
    await shadowText(el, 'Seeding');
  }
}`,...w.parameters?.docs?.source},description:{story:`H4: the Finished tab. Finished rows stay until deleted; Clear finished never touches a seeding torrent.`,...w.parameters?.docs?.description}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: 'H5 · Retrying tab',
  render: () => standalone({
    jobs: standaloneJobs()
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await waitFor(() => expect(tab(el, 'Retrying').textContent).toBe('Retrying1'));
    await userEvent.click(tab(el, 'Retrying'));
    const row = await rowNamed(el, 'nightly-build.zip');
    expect(row.textContent).toContain('Server answered 403 Forbidden');
    expect(row.textContent).toMatch(/Next try in \\d+m/);
    await userEvent.click(rowButton(row, 'Try now'));
    await waitFor(() => expect(channel().callsTo('send_download_resume')[0]).toEqual([expect.any(String), false, expect.any(Number)]));
  }
}`,...T.parameters?.docs?.source},description:{story:`H5: the Retrying tab. Try now skips the wait; Stop keeps the partial file.`,...T.parameters?.docs?.description}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: 'H6 · Choose folder',
  render: () => standalone({
    jobs: [],
    folders: {
      '': ['Downloads', 'movies', 'media', 'backups'],
      movies: ['2025', '2026']
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await userEvent.click(await waitForButton(el, 'Choose folder…'));
    const modal = await inShadow(el, '[aria-label="Save downloads to"]');
    await waitFor(() => expect(modal.querySelectorAll('.folder-row').length).toBe(4));
    await userEvent.click(Array.from(modal.querySelectorAll<HTMLButtonElement>('.folder-row')).find(b => b.textContent === 'movies')!);
    await waitFor(() => expect(channel().callsTo('send_download_folders').at(-1)?.[1]).toBe('movies'));
    await userEvent.click(await waitForButton(el, 'Save here'));
    await shadowText(el, \`saving to \${DOWNLOAD_FOLDER}/movies\`);
    typeInto(await inShadow<HTMLInputElement>(el, '#fetch-link'), 'https://example.org/a.iso');
    await userEvent.click(await waitForButton(el, 'Download'));
    await waitFor(() => expect(startArgs(channel().callsTo('send_download_start')).subDir).toBe('movies'));
  }
}`,...E.parameters?.docs?.source},description:{story:`H6: choosing a sub-folder of the download folder, listed by the agent.`,...E.parameters?.docs?.description}}}})))()}O();export{C as H3_Phone,w as H4_FinishedTab,T as H5_RetryingTab,E as H6_ChooseFolder,S as H_Desktop,D as __namedExportsOrder,b as default};