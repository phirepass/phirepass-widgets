import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{S as t,_ as n,a as r,b as i,c as a,d as o,l as s,n as c,o as l,p as u,s as d,t as f}from"./helpers-Dt93J4_G.js";var p,m,h,g,_,v,y,b,x,S,C,w,T,E;function D(){return(D=e((()=>{i(),l(),{expect:p,userEvent:m,waitFor:h}=__STORYBOOK_MODULE_TEST__,g={title:`Widgets/SFTP client`,parameters:{docs:{description:{component:"`<phirepass-sftp-client>`: browse, edit, upload and download files on a node over SFTP."}}}},_=(e={})=>({sftp:{cwd:u,tree:t()},...e}),v={render:()=>d(`phirepass-sftp-client`,{serviceId:`sftp-1`},_()).root,play:async({canvasElement:e})=>{let{el:t}=a(e);await r(t,`.content table tbody tr`),await s(t,`home-assistant-backup.tar`),p(t.shadowRoot.querySelector(`.action.fetch`)).toBeNull(),p(t.shadowRoot.querySelector(`phirepass-downloader`)).toBeNull()}},y={render:()=>d(`phirepass-sftp-client`,{serviceId:`sftp-1`},{sftp:{cwd:`/srv/empty`,tree:{"/srv/empty":[]}}}).root,play:async({canvasElement:e})=>{let{el:t}=a(e);await s(t,`This directory is empty.`)}},b={render:()=>d(`phirepass-sftp-client`,{serviceId:`sftp-1`},_()).root,play:async({canvasElement:e})=>{let{el:t}=a(e),n=await r(t,`input.filter`);await s(t,`notes.txt`),await m.type(n,`zzz`),await s(t,`Nothing here matches "zzz".`)}},x={render:()=>d(`phirepass-sftp-client`,{serviceId:`sftp-1`},{sftp:{cwd:u,tree:t(),requires:`both`}}).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=a(e),i=await r(t,`.creds form`);p(i.querySelector(`#username`)).toBeTruthy(),p(i.querySelector(`#password`)).toBeTruthy(),await m.type(i.querySelector(`#username`),`pi`),await m.type(i.querySelector(`#password`),`raspberry`),await m.click(i.querySelector(`button[type=submit]`)),await h(()=>p(n().callsTo(`open_sftp_tunnel`).at(-1)).toEqual([p.any(String),`sftp-1`,`pi`,`raspberry`]))}},S={render:()=>d(`phirepass-sftp-client`,{serviceId:`sftp-1`},{..._(),auth:`fail`}).root,play:async({canvasElement:e})=>{let{el:t}=a(e),n=await r(t,`.error`);p(n.textContent).toContain(`Your session has expired.`)}},C={render:()=>d(`phirepass-sftp-client`,{serviceId:`sftp-1`},_()).root,play:async({canvasElement:e})=>{let{el:t,channel:n}=a(e);await s(t,`notes.txt`),await m.click(await o(t,`New folder`));let i=await r(t,`.prompt-dialog input`);await m.type(i,`Movies`),await m.click(await o(t,`Create`)),await h(()=>p(n().callsTo(`send_sftp_mkdir`)[0][2]).toBe(`${u}/Movies`))}},w={render:()=>d(`phirepass-sftp-client`,{serviceId:`sftp-1`},_()).root,play:async({canvasElement:e})=>{let{el:t}=a(e);await s(t,`notes.txt`),await c(t,`Delete notes.txt`);let n=await r(t,`.delete-dialog`);p(n.textContent).toContain(`Are you sure you want to delete this file?`)}},T={render:()=>d(`phirepass-sftp-client`,{serviceId:`sftp-1`},{sftp:{cwd:`/etc/app`,tree:{"/etc/app":[n(`config.yaml`,`File`,{size:120},`/etc/app`)]}}}).root,play:async({canvasElement:e})=>{let{el:t}=a(e);await s(t,`config.yaml`),await c(t,`Edit config.yaml`);let n=await r(t,`.editor-text`);await h(()=>p(n.value).toContain(`listen: 0.0.0.0:8080`)),await m.type(n,`# edited`),await h(()=>p(f(t,`.editor-dialog .title`)[0].textContent).toContain(`*`))}},E=[`Listing`,`EmptyFolder`,`Filtered`,`AsksForCredentials`,`SessionExpired`,`NewFolderDialog`,`DeleteDialog`,`Editor`],v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-sftp-client', {
    serviceId: 'sftp-1'
  }, sftp()).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await inShadow(el, '.content table tbody tr');
    await shadowText(el, 'home-assistant-backup.tar');
    // A channel without Remote Fetch shows no Fetch button and no drawer.
    expect(el.shadowRoot!.querySelector('.action.fetch')).toBeNull();
    expect(el.shadowRoot!.querySelector('phirepass-downloader')).toBeNull();
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-sftp-client', {
    serviceId: 'sftp-1'
  }, {
    sftp: {
      cwd: '/srv/empty',
      tree: {
        '/srv/empty': []
      }
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await shadowText(el, 'This directory is empty.');
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-sftp-client', {
    serviceId: 'sftp-1'
  }, sftp()).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const filter = await inShadow<HTMLInputElement>(el, 'input.filter');
    await shadowText(el, 'notes.txt');
    await userEvent.type(filter, 'zzz');
    await shadowText(el, 'Nothing here matches "zzz".');
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-sftp-client', {
    serviceId: 'sftp-1'
  }, {
    sftp: {
      cwd: MEDIA_FOLDER,
      tree: mediaListing(),
      requires: 'both'
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    const form = await inShadow<HTMLFormElement>(el, '.creds form');
    expect(form.querySelector('#username')).toBeTruthy();
    expect(form.querySelector('#password')).toBeTruthy();
    await userEvent.type(form.querySelector('#username')!, 'pi');
    await userEvent.type(form.querySelector('#password')!, 'raspberry');
    await userEvent.click(form.querySelector('button[type=submit]')!);
    await waitFor(() => expect(channel().callsTo('open_sftp_tunnel').at(-1)).toEqual([expect.any(String), 'sftp-1', 'pi', 'raspberry']));
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-sftp-client', {
    serviceId: 'sftp-1'
  }, {
    ...sftp(),
    auth: 'fail'
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const banner = await inShadow(el, '.error');
    expect(banner.textContent).toContain('Your session has expired.');
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-sftp-client', {
    serviceId: 'sftp-1'
  }, sftp()).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await shadowText(el, 'notes.txt');
    await userEvent.click(await waitForButton(el, 'New folder'));
    const input = await inShadow<HTMLInputElement>(el, '.prompt-dialog input');
    await userEvent.type(input, 'Movies');
    await userEvent.click(await waitForButton(el, 'Create'));
    await waitFor(() => expect(channel().callsTo('send_sftp_mkdir')[0][2]).toBe(\`\${MEDIA_FOLDER}/Movies\`));
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-sftp-client', {
    serviceId: 'sftp-1'
  }, sftp()).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await shadowText(el, 'notes.txt');
    await clickRowAction(el, 'Delete notes.txt');
    const dialog = await inShadow(el, '.delete-dialog');
    expect(dialog.textContent).toContain('Are you sure you want to delete this file?');
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-sftp-client', {
    serviceId: 'sftp-1'
  }, {
    sftp: {
      cwd: '/etc/app',
      tree: {
        '/etc/app': [entry('config.yaml', 'File', {
          size: 120
        }, '/etc/app')]
      }
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await shadowText(el, 'config.yaml');
    await clickRowAction(el, 'Edit config.yaml');
    const area = await inShadow<HTMLTextAreaElement>(el, '.editor-text');
    await waitFor(() => expect(area.value).toContain('listen: 0.0.0.0:8080'));
    await userEvent.type(area, '# edited');
    await waitFor(() => expect(allInShadow(el, '.editor-dialog .title')[0].textContent).toContain('*'));
  }
}`,...T.parameters?.docs?.source}}}})))()}D();export{x as AsksForCredentials,w as DeleteDialog,T as Editor,y as EmptyFolder,b as Filtered,v as Listing,C as NewFolderDialog,S as SessionExpired,E as __namedExportsOrder,g as default};