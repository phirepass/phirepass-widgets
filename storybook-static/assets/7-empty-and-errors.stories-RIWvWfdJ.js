import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{c as t,d as n,l as r,o as i,s as a}from"./helpers-Dt93J4_G.js";import{r as o,s,t as c}from"./fetch-helpers-aFemxpB-.js";var l,u,d,f,p,m,h,g,_,v,y;function b(){return(b=e((()=>{o(),i(),{expect:l,userEvent:u,waitFor:d}=__STORYBOOK_MODULE_TEST__,f={title:`Remote Fetch/7 · Empty, unavailable and error screens`},p={name:`X1 · Drawer with nothing in it`,render:()=>c({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:n}=t(e);await n.toggleDrawer(!0),await r(n,`No downloads yet`),await r(n,`Downloads keep running after you close this tab`)}},m={name:`X2 · Standalone, first use`,render:()=>s({jobs:[]}).root,play:async({canvasElement:e})=>{let{el:n}=t(e);await r(n,`Nothing downloading`),await r(n,`It downloads onto raspberrypi, into /home/pi/Downloads.`)}},h={name:`X3 · Standalone, not signed in`,render:()=>s({jobs:[]},{mock:{auth:`fail`}}).root,play:async({canvasElement:e})=>{let{el:i}=t(e),a=[];i.addEventListener(`phirepassSignIn`,()=>a.push(1)),await r(i,`Sign in to PhirePass`),await u.click(await n(i,`Sign in`)),l(a.length).toBe(1)}},g={name:`X3 · Standalone, no token`,render:()=>s({jobs:[]},{props:{token:void 0}}).root,play:async({canvasElement:e})=>{let{el:n}=t(e);await r(n,`Your downloads are tied to your account`)}},_={name:`X4 · Node cannot be reached`,render:()=>s({jobs:[]},{mock:{connect:`refuse`}}).root,play:async({canvasElement:e})=>{let{el:i,channel:a}=t(e);await r(i,`Can't reach raspberrypi`),await r(i,`its downloads carry on`);let o=a();await u.click(await n(i,`Try again`)),await d(()=>l(a()).not.toBe(o))}},v={name:`Channel without Remote Fetch`,render:()=>a(`phirepass-downloader`,{nodeLabel:`raspberrypi`},{},{height:300}).root,play:async({canvasElement:e})=>{let{el:n}=t(e);await r(n,`Downloads are not available here`)}},y=[`X1_EmptyDrawer`,`X2_StandaloneFirstUse`,`X3_NotSignedIn`,`X3_NoToken`,`X4_Unreachable`,`OldChannel`],p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: 'X1 · Drawer with nothing in it',
  render: () => embedded({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await (el as any).toggleDrawer(true);
    await shadowText(el, 'No downloads yet');
    await shadowText(el, 'Downloads keep running after you close this tab');
  }
}`,...p.parameters?.docs?.source},description:{story:`X1 (embedded): see group 1. This is the drawer on its own.`,...p.parameters?.docs?.description}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: 'X2 · Standalone, first use',
  render: () => standalone({
    jobs: []
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await shadowText(el, 'Nothing downloading');
    await shadowText(el, 'It downloads onto raspberrypi, into /home/pi/Downloads.');
  }
}`,...m.parameters?.docs?.source},description:{story:`X2: standalone, first open on a node with Downloads on.`,...m.parameters?.docs?.description}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: 'X3 · Standalone, not signed in',
  render: () => standalone({
    jobs: []
  }, {
    mock: {
      auth: 'fail'
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    const signIn: unknown[] = [];
    el.addEventListener('phirepassSignIn', () => signIn.push(1));
    await shadowText(el, 'Sign in to PhirePass');
    await userEvent.click(await waitForButton(el, 'Sign in'));
    expect(signIn.length).toBe(1);
  }
}`,...h.parameters?.docs?.source},description:{story:`X3: no valid session.`,...h.parameters?.docs?.description}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'X3 · Standalone, no token',
  render: () => standalone({
    jobs: []
  }, {
    props: {
      token: undefined
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await shadowText(el, 'Your downloads are tied to your account');
  }
}`,...g.parameters?.docs?.source},description:{story:`X3 without a token at all.`,...g.parameters?.docs?.description}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: 'X4 · Node cannot be reached',
  render: () => standalone({
    jobs: []
  }, {
    mock: {
      connect: 'refuse'
    }
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el,
      channel
    } = mounted(canvasElement);
    await shadowText(el, "Can't reach raspberrypi");
    await shadowText(el, 'its downloads carry on');
    const first = channel();
    await userEvent.click(await waitForButton(el, 'Try again'));
    await waitFor(() => expect(channel()).not.toBe(first));
  }
}`,..._.parameters?.docs?.source},description:{story:`X4: the node (or server) cannot be reached; Try again reconnects.`,..._.parameters?.docs?.description}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'Channel without Remote Fetch',
  render: () => mount('phirepass-downloader', {
    nodeLabel: 'raspberrypi'
  }, {}, {
    height: 300
  }).root,
  play: async ({
    canvasElement
  }) => {
    const {
      el
    } = mounted(canvasElement);
    await shadowText(el, 'Downloads are not available here');
  }
}`,...v.parameters?.docs?.source},description:{story:`A page whose channel predates Remote Fetch.`,...v.parameters?.docs?.description}}}})))()}b();export{v as OldChannel,p as X1_EmptyDrawer,m as X2_StandaloneFirstUse,g as X3_NoToken,h as X3_NotSignedIn,_ as X4_Unreachable,y as __namedExportsOrder,f as default};