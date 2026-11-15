import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{a as t,d as n,o as r,r as i}from"./helpers-Dt93J4_G.js";function a(e,t=360){let n=document.createElement(`phirepass-media-player`);Object.assign(n,{src:`/assets/sample.webm`,name:`big_buck_bunny_1080p.webm`,status:`Downloading · 38.7%`,...e});let r=i(n,{height:t,width:640});return r.__player=n,r}function o(e){let t={...e};return{data:t,async get(e){return t[e]??null},async set(e,n,r){t[e]={secs:n,duration:r,at:Date.now()}},async clear(e){delete t[e]}}}function s(){let e={},t={state:`disconnected`,async watchAvailability(e){return e(!0),1},async cancelWatchAvailability(){},async prompt(){t.state=`connected`,t.fire(`connect`)},addEventListener(t,n){(e[t]??=[]).push(n)},removeEventListener(t,n){e[t]=(e[t]??[]).filter(e=>e!==n)},fire(t){(e[t]??[]).forEach(e=>e())}};return t}var c,l,u,d,f,p,m,h,g,_,v,y,b,x,S;function C(){return(C=e((()=>{r(),{expect:c,userEvent:l,waitFor:u}=__STORYBOOK_MODULE_TEST__,d={title:`Remote Fetch/8 · Player`,parameters:{docs:{description:{component:"The browser’s own `<video>`/`<audio>` on a stream URL. Each phase (G–G7) is its own story."}}}},f=e=>e.querySelector(`phirepass-media-player`),p=e=>e.shadowRoot?.querySelector(`.stage`)?.dataset.phase,m=e=>e.shadowRoot.querySelector(`video, audio`),h={name:`G · Play while downloading`,render:()=>a({ready:356e6}),play:async({canvasElement:e})=>{let r=f(e);await t(r,`video`),c(r.shadowRoot.textContent).toContain(`Downloading · 38.7%`),await u(()=>c(p(r)).toBe(`playing`),{timeout:6e3});let i=[];r.addEventListener(`phirepassPlayerClose`,()=>i.push(1)),await l.click(await n(r,`Close player`)),c(i.length).toBe(1)}},g={name:`G2 · Waiting for this part`,render:()=>a({ready:12e7}),play:async({canvasElement:e})=>{let t=f(e);await u(()=>c(p(t)).toBe(`playing`),{timeout:6e3}),m(t).dispatchEvent(new Event(`playing`)),m(t).dispatchEvent(new Event(`waiting`)),await u(()=>c(p(t)).toBe(`waiting`)),c(t.shadowRoot.textContent).toContain(`Waiting for this part to download`),m(t).dispatchEvent(new Event(`canplay`)),await u(()=>c(p(t)).toBe(`playing`))}},_={name:`G3 · Format not supported`,render:()=>a({src:`/assets/not-a-video.mkv`,name:`Sintel.2010.1080p.mkv`,status:`On the node`}),play:async({canvasElement:e})=>{let t=f(e);await u(()=>c(p(t)).toBe(`unsupported`),{timeout:6e3}),c(t.shadowRoot.textContent).toContain(`This browser cannot play this format`);let n=t.shadowRoot.querySelector(`a[download]`);c(n.getAttribute(`download`)).toBe(`Sintel.2010.1080p.mkv`),c(t.shadowRoot.querySelector(`[aria-label^="Cast unavailable"]`)).toBeTruthy()}},v={name:`G4 · Connection lost`,render:()=>a({}),play:async({canvasElement:e})=>{let t=f(e);await u(()=>c(p(t)).toBe(`playing`),{timeout:6e3});let r=m(t);Object.defineProperty(r,"error",{configurable:!0,get:()=>({code:2,message:`network`})}),r.dispatchEvent(new Event(`error`)),await u(()=>c(p(t)).toBe(`stopped`)),c(t.shadowRoot.textContent).toContain(`The connection to the node was lost.`),delete r.error,await l.click(await n(t,`Try again`)),await u(()=>c(p(t)).toBe(`playing`),{timeout:6e3})}},y={name:`G5 · Audio`,render:()=>a({src:`/assets/podcast-ep-212.mp3`,name:`podcast-ep-212.mp3`,status:`On the node`},160),play:async({canvasElement:e})=>{let n=f(e);await t(n,`audio`),c(n.classList.contains(`audio`)).toBe(!0),c(n.shadowRoot.querySelector(`video`)).toBeNull(),c(n.shadowRoot.querySelector(`[aria-label="Cast"]`)).toBeNull()}},b={name:`G6 · Continue watching`,render:()=>a({positionKey:`dl:dl-1:0`,positionStore:o({"dl:dl-1:0":{secs:1872,duration:5940,at:Date.now()-864e5}}),status:`On the node`}),play:async({canvasElement:e})=>{let t=f(e);await u(()=>c(p(t)).toBe(`prompt`)),c(t.shadowRoot.textContent).toMatch(/Resume from 31:12\?/),c(m(t).classList.contains(`hidden`)).toBe(!0),await l.click(await n(t,`Start over`)),await u(()=>c(p(t)).not.toBe(`prompt`)),c(m(t).currentTime).toBeLessThan(2)}},x={name:`G7 · Casting`,render:()=>a({remotePlayback:s(),castDevice:`Living room TV`,status:`On the node`}),play:async({canvasElement:e})=>{let t=f(e);await l.click(await n(t,`Cast`)),await u(()=>c(p(t)).toBe(`casting`)),c(t.shadowRoot.textContent).toContain(`Playing on Living room TV`),t.remotePlayback.fire(`disconnect`),await u(()=>c(p(t)).not.toBe(`casting`))}},S=[`G_PlayWhileDownloading`,`G2_WaitingForPart`,`G3_Unsupported`,`G4_ConnectionLost`,`G5_Audio`,`G6_ContinueWatching`,`G7_Casting`],h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: 'G · Play while downloading',
  render: () => player({
    ready: 356_000_000
  }),
  play: async ({
    canvasElement
  }) => {
    const el = playerIn(canvasElement);
    await inShadow(el, 'video');
    expect(el.shadowRoot!.textContent).toContain('Downloading · 38.7%');
    await waitFor(() => expect(phase(el)).toBe('playing'), {
      timeout: 6000
    });
    const closed: unknown[] = [];
    el.addEventListener('phirepassPlayerClose', () => closed.push(1));
    await userEvent.click(await waitForButton(el, 'Close player'));
    expect(closed.length).toBe(1);
  }
}`,...h.parameters?.docs?.source},description:{story:`G: Play while downloading. Buffering, then the picture.`,...h.parameters?.docs?.description}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'G2 · Waiting for this part',
  render: () => player({
    ready: 120_000_000
  }),
  play: async ({
    canvasElement
  }) => {
    const el = playerIn(canvasElement);
    await waitFor(() => expect(phase(el)).toBe('playing'), {
      timeout: 6000
    });
    media(el).dispatchEvent(new Event('playing'));
    media(el).dispatchEvent(new Event('waiting'));
    await waitFor(() => expect(phase(el)).toBe('waiting'));
    expect(el.shadowRoot!.textContent).toContain('Waiting for this part to download');
    media(el).dispatchEvent(new Event('canplay'));
    await waitFor(() => expect(phase(el)).toBe('playing'));
  }
}`,...g.parameters?.docs?.source},description:{story:`G2: a seek past what the node has stalls; the player says why.`,...g.parameters?.docs?.description}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: 'G3 · Format not supported',
  render: () => player({
    src: '/assets/not-a-video.mkv',
    name: 'Sintel.2010.1080p.mkv',
    status: 'On the node'
  }),
  play: async ({
    canvasElement
  }) => {
    const el = playerIn(canvasElement);
    await waitFor(() => expect(phase(el)).toBe('unsupported'), {
      timeout: 6000
    });
    expect(el.shadowRoot!.textContent).toContain('This browser cannot play this format');
    const link = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[download]')!;
    expect(link.getAttribute('download')).toBe('Sintel.2010.1080p.mkv');
    // MKV cannot be cast either; the button says so instead of hiding.
    expect(el.shadowRoot!.querySelector('[aria-label^="Cast unavailable"]')).toBeTruthy();
  }
}`,..._.parameters?.docs?.source},description:{story:`G3: a format the browser cannot decode.`,..._.parameters?.docs?.description}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'G4 · Connection lost',
  render: () => player({}),
  play: async ({
    canvasElement
  }) => {
    const el = playerIn(canvasElement);
    await waitFor(() => expect(phase(el)).toBe('playing'), {
      timeout: 6000
    });
    const m = media(el);
    Object.defineProperty(m, 'error', {
      configurable: true,
      get: () => ({
        code: 2,
        message: 'network'
      })
    });
    m.dispatchEvent(new Event('error'));
    await waitFor(() => expect(phase(el)).toBe('stopped'));
    expect(el.shadowRoot!.textContent).toContain('The connection to the node was lost.');
    delete (m as any).error;
    await userEvent.click(await waitForButton(el, 'Try again'));
    await waitFor(() => expect(phase(el)).toBe('playing'), {
      timeout: 6000
    });
  }
}`,...v.parameters?.docs?.source},description:{story:`G4: the connection to the node dropped mid-play.`,...v.parameters?.docs?.description}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'G5 · Audio',
  render: () => player({
    src: '/assets/podcast-ep-212.mp3',
    name: 'podcast-ep-212.mp3',
    status: 'On the node'
  }, 160),
  play: async ({
    canvasElement
  }) => {
    const el = playerIn(canvasElement);
    await inShadow(el, 'audio');
    expect(el.classList.contains('audio')).toBe(true);
    expect(el.shadowRoot!.querySelector('video')).toBeNull();
    expect(el.shadowRoot!.querySelector('[aria-label="Cast"]')).toBeNull();
  }
}`,...y.parameters?.docs?.source},description:{story:`G5: audio gets a slim player and no cast button.`,...y.parameters?.docs?.description}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: 'G6 · Continue watching',
  render: () => player({
    positionKey: 'dl:dl-1:0',
    positionStore: memoryStore({
      'dl:dl-1:0': {
        secs: 1872,
        duration: 5940,
        at: Date.now() - 86_400_000
      }
    }),
    status: 'On the node'
  }),
  play: async ({
    canvasElement
  }) => {
    const el = playerIn(canvasElement);
    await waitFor(() => expect(phase(el)).toBe('prompt'));
    expect(el.shadowRoot!.textContent).toMatch(/Resume from 31:12\\?/);
    expect(media(el).classList.contains('hidden')).toBe(true);
    await userEvent.click(await waitForButton(el, 'Start over'));
    await waitFor(() => expect(phase(el)).not.toBe('prompt'));
    expect(media(el).currentTime).toBeLessThan(2);
  }
}`,...b.parameters?.docs?.source},description:{story:`G6: continue watching from where it stopped.`,...b.parameters?.docs?.description}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: 'G7 · Casting',
  render: () => player({
    remotePlayback: fakeRemote(),
    castDevice: 'Living room TV',
    status: 'On the node'
  }),
  play: async ({
    canvasElement
  }) => {
    const el = playerIn(canvasElement);
    await userEvent.click(await waitForButton(el, 'Cast'));
    await waitFor(() => expect(phase(el)).toBe('casting'));
    expect(el.shadowRoot!.textContent).toContain('Playing on Living room TV');
    (el.remotePlayback as ReturnType<typeof fakeRemote>).fire('disconnect');
    await waitFor(() => expect(phase(el)).not.toBe('casting'));
  }
}`,...x.parameters?.docs?.source},description:{story:`G7: casting to a TV; the TV reads from the node.`,...x.parameters?.docs?.description}}}})))()}C();export{g as G2_WaitingForPart,_ as G3_Unsupported,v as G4_ConnectionLost,y as G5_Audio,b as G6_ContinueWatching,x as G7_Casting,h as G_PlayWhileDownloading,S as __namedExportsOrder,d as default};