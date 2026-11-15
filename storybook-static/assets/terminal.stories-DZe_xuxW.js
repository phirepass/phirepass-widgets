import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{a as t,c as n,o as r,s as i}from"./helpers-Dt93J4_G.js";var a,o,s,c,l,u,d,f;function p(){return(p=e((()=>{r(),{expect:a,waitFor:o}=__STORYBOOK_MODULE_TEST__,s=`\x1B[1;32mWelcome to raspberrypi\x1B[0m (Debian GNU/Linux 13)\r
\r
pi@raspberrypi:~ $ `,c={title:`Widgets/Terminal`,parameters:{docs:{description:{component:"`<phirepass-terminal>`: an SSH session in xterm.js, over the channel."}}}},l={render:()=>i(`phirepass-terminal`,{serviceId:`ssh-1`},{ssh:{banner:s,echo:!0}}).root,play:async({canvasElement:e})=>{let{el:r,channel:i}=n(e);await t(r,`.xterm`),await o(()=>a(i().callsTo(`authenticate`)).toEqual([[`story-token`,a.any(String)]])),await o(()=>a(i().callsTo(`open_ssh_tunnel`).length).toBe(1)),a(i().callsTo(`start_heartbeat`).length).toBe(1)}},u={render:()=>i(`phirepass-terminal`,{serviceId:`ssh-1`},{ssh:{requires:`username`}}).root,play:async({canvasElement:e})=>{let{el:r,channel:i}=n(e);await t(r,`.xterm`),await o(()=>a(i().callsTo(`open_ssh_tunnel`).length).toBe(1)),a(i().callsTo(`send_ssh_tunnel_data`)).toEqual([])}},d={render:()=>i(`phirepass-terminal`,{serviceId:`ssh-1`},{connect:`refuse`}).root,play:async({canvasElement:e})=>{let{el:t,channel:r}=n(e),i=[];t.addEventListener(`connectionStateChanged`,e=>i.push(e.detail[0])),await o(()=>a(r().callsTo(`connect`).length).toBeGreaterThan(0)),a(r().callsTo(`authenticate`)).toEqual([])}},f=[`Connected`,`AsksForUsername`,`ConnectionRefused`],l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-terminal', {
    serviceId: 'ssh-1'
  }, {
    ssh: {
      banner: BANNER,
      echo: true
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await inShadow(el, '.xterm');
    await waitFor(() => expect(channel().callsTo('authenticate')).toEqual([['story-token', expect.any(String)]]));
    await waitFor(() => expect(channel().callsTo('open_ssh_tunnel').length).toBe(1));
    expect(channel().callsTo('start_heartbeat').length).toBe(1);
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-terminal', {
    serviceId: 'ssh-1'
  }, {
    ssh: {
      requires: 'username'
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await inShadow(el, '.xterm');
    // The terminal asks in-band; nothing is sent until a username is typed.
    await waitFor(() => expect(channel().callsTo('open_ssh_tunnel').length).toBe(1));
    expect(channel().callsTo('send_ssh_tunnel_data')).toEqual([]);
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => mount('phirepass-terminal', {
    serviceId: 'ssh-1'
  }, {
    connect: 'refuse'
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    const states: unknown[] = [];
    el.addEventListener('connectionStateChanged', e => states.push((e as CustomEvent).detail[0]));
    await waitFor(() => expect(channel().callsTo('connect').length).toBeGreaterThan(0));
    expect(channel().callsTo('authenticate')).toEqual([]);
  }
}`,...d.parameters?.docs?.source}}}})))()}p();export{u as AsksForUsername,l as Connected,d as ConnectionRefused,f as __namedExportsOrder,c as default};