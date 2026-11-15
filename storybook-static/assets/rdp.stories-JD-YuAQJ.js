import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{a as t,c as n,o as r,s as i}from"./helpers-Dt93J4_G.js";var a,o,s,c,l,u,d;function f(){return(f=e((()=>{r(),{expect:a,userEvent:o,waitFor:s}=__STORYBOOK_MODULE_TEST__,c={title:`Widgets/Remote desktop`,parameters:{docs:{description:{component:"`<phirepass-rdp>`: a Windows desktop over RDP. The desktop itself needs a real host, so these stories cover what happens before it."}}}},l={render:()=>i(`phirepass-rdp`,{serviceId:`rdp-1`},{},{height:360}).root,play:async({canvasElement:e})=>{let{el:r,channel:i}=n(e),c=await t(r,`form.prompt`);await o.type(c.querySelector(`#rdp-username`),`Administrator`),await o.type(c.querySelector(`#rdp-password`),`hunter2`),await o.click(c.querySelector(`button[type=submit]`)),await s(()=>a(i().callsTo(`open_rdp_tunnel`).at(-1)).toEqual([a.any(String),`rdp-1`,`Administrator`,`hunter2`]))}},u={render:()=>i(`phirepass-rdp`,{serviceId:`rdp-1`,username:`Administrator`,password:`wrong`},{rdp:{error:`The node refused the RDP login.`}},{height:360}).root,play:async({canvasElement:e})=>{let{el:r,channel:i}=n(e);await s(()=>a(i().callsTo(`open_rdp_tunnel`).length).toBe(1));let o=await t(r,`.status`);a(o.textContent).toContain(`refused`)}},d=[`AsksForCredentials`,`Refused`],l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-rdp', {
    serviceId: 'rdp-1'
  }, {}, {
    height: 360
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    const form = await inShadow<HTMLFormElement>(el, 'form.prompt');
    await userEvent.type(form.querySelector('#rdp-username')!, 'Administrator');
    await userEvent.type(form.querySelector('#rdp-password')!, 'hunter2');
    await userEvent.click(form.querySelector('button[type=submit]')!);
    await waitFor(() => expect(channel().callsTo('open_rdp_tunnel').at(-1)).toEqual([expect.any(String), 'rdp-1', 'Administrator', 'hunter2']));
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-rdp', {
    serviceId: 'rdp-1',
    username: 'Administrator',
    password: 'wrong'
  }, {
    rdp: {
      error: 'The node refused the RDP login.'
    }
  }, {
    height: 360
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await waitFor(() => expect(channel().callsTo('open_rdp_tunnel').length).toBe(1));
    const status = await inShadow(el, '.status');
    expect(status.textContent).toContain('refused');
  }
}`,...u.parameters?.docs?.source}}}})))()}f();export{l as AsksForCredentials,u as Refused,d as __namedExportsOrder,c as default};