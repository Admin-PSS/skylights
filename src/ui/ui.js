import { FORMATIONS } from '../drones/formations.js';
import { EFFECTS, PALETTES } from '../drones/effects.js';
import { stepLabel, stepSub, PRESETS, LASER_MODES, FIREWORK_MODES, BALLOON_MODES } from '../show/show.js';
import { ShowRecorder, pickFormat } from './recorder.js';
import { DEFAULT_TITLE } from '../scene/titlecard.js';

const $ = (id) => document.getElementById(id);

/** Wires the HTML controls to the app. */
export function initUI(app) {
  const { show, audio } = app;
  const panel = $('panel');
  const isNarrow = () => window.innerWidth <= 760;

  // ---------- Panel & tabs ----------
  const setPanel = (open) => {
    panel.classList.toggle('open', open);
    document.body.classList.toggle('panel-open', open);
  };
  setPanel(!isNarrow());
  $('btnPanel').onclick = () => setPanel(!panel.classList.contains('open'));

  let activeTab = 'show';
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.onclick = () => {
      activeTab = b.dataset.tab;
      document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === activeTab));
    };
  });

  const setHidden = (h) => document.body.classList.toggle('ui-hidden', h);
  $('btnHide').onclick = () => setHidden(true);
  $('btnShowUI').onclick = () => setHidden(false);

  // ---------- Transport ----------
  const playBtn = $('btnPlay');
  const syncPlay = () => (playBtn.textContent = show.playing ? '⏸' : '▶');
  playBtn.onclick = () => show.setPlaying(!show.playing);
  $('btnPrev').onclick = () => show.prev();
  $('btnNext').onclick = () => show.next();

  // ---------- Show list ----------
  const list = $('stepList');
  const renderList = () => {
    list.innerHTML = '';
    show.steps.forEach((s, i) => {
      const li = document.createElement('li');
      if (i === show.index && show.current === s) li.classList.add('current');
      const c = PALETTES[s.palette]?.colors ?? ['#fff'];
      li.innerHTML = `
        <span class="num">${i + 1}</span>
        <span class="dot" style="background:linear-gradient(135deg,${c.join(',')})"></span>
        <span class="info"><div class="title"></div><div class="sub"></div></span>
        <button class="act" data-act="up" title="Move up">↑</button>
        <button class="act" data-act="del" title="Remove">✕</button>`;
      li.querySelector('.title').textContent = `${FORMATIONS[s.formation]?.icon ?? ''} ${stepLabel(s)}`;
      li.querySelector('.sub').textContent = stepSub(s);
      li.onclick = (e) => {
        const act = e.target.dataset?.act;
        if (act === 'del') { if (show.steps.length > 1) show.remove(i); }
        else if (act === 'up') show.move(i, -1);
        else { show.goTo(i); show.setPlaying(true); }
      };
      list.appendChild(li);
    });
  };
  $('chkLoop').onchange = (e) => (show.loop = e.target.checked);
  const selPreset = $('selPreset');
  Object.entries(PRESETS).forEach(([id, p]) => selPreset.add(new Option(p.name, id)));
  $('btnResetShow').onclick = () => show.reset(selPreset.value);

  const caption = $('caption');
  const setCaption = () => {
    const s = show.current;
    if (!s) return;
    caption.style.opacity = 0;
    setTimeout(() => {
      caption.textContent = `${stepLabel(s)} · ${EFFECTS[s.effect]?.name ?? ''}`;
      caption.style.opacity = 1;
    }, 250);
  };

  show.on((type) => {
    if (type === 'play') syncPlay();
    if (type === 'step') setCaption();
    if (type === 'step' || type === 'list') renderList();
  });

  // ---------- Create ----------
  const selF = $('selFormation');
  Object.entries(FORMATIONS).forEach(([id, f]) => selF.add(new Option(`${f.icon}  ${f.name}`, id)));
  selF.value = 'text';
  const selE = $('selEffect');
  Object.entries(EFFECTS).forEach(([id, e]) => selE.add(new Option(e.name, id)));
  selE.value = 'wave';
  const selL = $('selLaser');
  Object.entries(LASER_MODES).forEach(([id, n]) => selL.add(new Option(n, id)));
  const selFw = $('selFireworks');
  Object.entries(FIREWORK_MODES).forEach(([id, n]) => selFw.add(new Option(n, id)));
  const selB = $('selBalloons');
  Object.entries(BALLOON_MODES).forEach(([id, n]) => selB.add(new Option(n, id)));

  let palette = 'neon';
  const sw = $('palettes');
  Object.entries(PALETTES).forEach(([id, p]) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (id === palette ? ' active' : '');
    b.title = p.name;
    b.style.background = `linear-gradient(135deg, ${p.colors.join(', ')})`;
    b.onclick = () => {
      palette = id;
      sw.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === b));
    };
    sw.appendChild(b);
  });

  let imageData = null;
  const syncFields = () => {
    $('textField').hidden = selF.value !== 'text';
    $('imageField').hidden = selF.value !== 'image';
    if (selF.value === 'image' && selE.value !== 'image') selE.value = 'image';
    if (selF.value === 'loom') selE.value = 'weave';
  };
  selF.onchange = syncFields;
  syncFields();

  $('inpImage').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    imageData = await shrinkImage(file, 260);
    const prev = $('imgPreview');
    prev.src = imageData;
    prev.hidden = false;
  };

  const dur = $('rngDur');
  dur.oninput = () => ($('durVal').textContent = `${dur.value}s`);

  const currentDraft = () => {
    const s = { formation: selF.value, effect: selE.value, palette, duration: +dur.value, laser: selL.value, fireworks: selFw.value, balloons: selB.value };
    if (s.formation === 'text') s.text = $('inpText').value.trim() || 'HELLO';
    if (s.formation === 'image') {
      if (!imageData) { alert('Choose an image first.'); return null; }
      s.image = imageData;
    }
    return s;
  };
  $('btnPreview').onclick = () => {
    const s = currentDraft();
    if (s) show.preview(s);
  };
  $('btnAdd').onclick = () => {
    const s = currentDraft();
    if (!s) return;
    const st = show.add(s);
    show.goTo(show.steps.indexOf(st));
    show.setPlaying(true);
  };

  // ---------- Music ----------
  audio.onchange = (mode, label) => {
    $('audioStatus').textContent = label;
    $('btnDemoBeat').classList.toggle('on', mode === 'demo');
    $('btnMic').classList.toggle('on', mode === 'mic');
  };
  $('btnDemoBeat').onclick = () => (audio.mode === 'demo' ? audio.stop() : audio.startDemo());
  $('btnMic').onclick = () => (audio.mode === 'mic' ? audio.stop() : audio.startMic());
  $('btnStopAudio').onclick = () => audio.stop();
  $('inpAudio').onchange = (e) => {
    const f = e.target.files[0];
    if (f) audio.playFile(f).catch(() => ($('audioStatus').textContent = 'Could not play that file.'));
    e.target.value = '';
  };
  $('chkReact').onchange = (e) => (app.settings.react = e.target.checked);
  $('chkBoom').onchange = (e) => (audio.sfxOn = e.target.checked);
  $('rngSens').oninput = (e) => (app.settings.sensitivity = +e.target.value);

  const meter = $('meter');
  const mctx = meter.getContext('2d');
  const drawMeter = () => {
    const w = meter.width, h = meter.height;
    mctx.clearRect(0, 0, w, h);
    if (!audio.data || audio.mode === 'none') return;
    const bars = 48;
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor(Math.pow(i / bars, 1.8) * audio.data.length * 0.7) + 1;
      const v = audio.data[idx] / 255;
      const hue = 190 + (i / bars) * 120;
      mctx.fillStyle = `hsl(${hue} 90% 60%)`;
      mctx.fillRect(i * bw + 1, h - v * h, bw - 2, v * h);
    }
  };

  // ---------- View ----------
  document.querySelectorAll('[data-cam]').forEach((b) => (b.onclick = () => app.setCamera(b.dataset.cam)));
  $('chkOrbit').onchange = (e) => app.setOrbit(e.target.checked);
  $('chkSpots').onchange = (e) => app.setSpotlights(e.target.checked);
  const chkWater = $('chkWater');
  chkWater.checked = app.settings.water;
  chkWater.onchange = (e) => app.setWater(e.target.checked);
  $('rngBloom').oninput = (e) => app.setBloom(+e.target.value);
  $('chkLasers').onchange = (e) => (app.settings.lasers = e.target.checked);
  $('chkFireworks').onchange = (e) => (app.settings.fireworks = e.target.checked);
  $('chkMoon').onchange = (e) => app.setMoon(e.target.checked);
  $('chkPagoda').onchange = (e) => app.setPagoda(e.target.checked);
  $('chkLanterns').onchange = (e) => app.setLanterns(e.target.checked);
  $('chkBalloons').onchange = (e) => app.setBalloons(e.target.checked);
  $('btnFire').onclick = () => app.fireVolley();
  const selCount = $('selCount');
  selCount.value = String(app.settings.count);
  selCount.onchange = () => app.setDroneCount(+selCount.value);

  // ---------- Title card ----------
  const tc = app.titleCard;
  const tcFields = { tcTitle: 'title', tcSubtitle: 'subtitle', tcDate: 'dateLine', tcPresenter: 'presenter', tcEndTitle: 'endTitle', tcEndSub: 'endSub' };
  const tcChecks = { chkTitleIntro: 'intro', chkTitleOutro: 'outro', chkTitleCredit: 'credit' };
  const fillTitleForm = () => {
    Object.entries(tcFields).forEach(([id, key]) => ($(id).value = tc.text[key] ?? ''));
    Object.entries(tcChecks).forEach(([id, key]) => ($(id).checked = !!tc.text[key]));
  };
  fillTitleForm();
  Object.entries(tcFields).forEach(([id, key]) => ($(id).oninput = (e) => tc.set({ [key]: e.target.value })));
  Object.entries(tcChecks).forEach(([id, key]) => ($(id).onchange = (e) => tc.set({ [key]: e.target.checked })));
  $('btnTcIntro').onclick = () => tc.play('intro', 3.5);
  $('btnTcOutro').onclick = () => tc.play('outro', 3.5);
  $('btnTcReset').onclick = () => { tc.set({ ...DEFAULT_TITLE, presenter: tc.text.presenter }); fillTitleForm(); };

  // ---------- Video recording ----------
  const recorder = new ShowRecorder(document.getElementById('scene'), audio);
  const recBtn = $('btnRec');
  const recStatus = $('recStatus');
  let wholeShow = false;
  let savedLoop = true;
  let lastUrl = null;

  const fmt = pickFormat();
  recStatus.textContent = fmt
    ? `Videos are saved as ${fmt.ext.toUpperCase()}.`
    : 'Sorry — this browser cannot record video. Try Chrome, Edge or Safari.';

  const startRecording = async (fromStart) => {
    if (recorder.recording) return;
    audio.unlock();
    const sizeVal = $('selVidSize').value;
    const size = sizeVal === 'screen' ? null : sizeVal.split('x').map(Number);
    app.setRenderSize(size);
    const px = size ? size[0] * size[1] : window.innerWidth * window.innerHeight * devicePixelRatio ** 2;
    const fps = +$('selVidFps').value;
    const bitrate = Math.round(Math.min(20e6, Math.max(4e6, px * fps * 0.2)));
    wholeShow = fromStart;
    if (fromStart) {
      savedLoop = show.loop;
      show.loop = false;
      await show.start(); // drones back on the launch pad, step 1
      show.setPlaying(false);
    }
    if (!recorder.start({ fps, bitrate, withAudio: $('chkVidAudio').checked })) {
      app.setRenderSize(null);
      return;
    }
    if (tc.text.intro) await tc.play('intro', 4.5); // the show waits on the launch pad under the title
    if (fromStart && recorder.recording) show.setPlaying(true);
  };
  let stopping = false;
  const stopRecording = async () => {
    if (!recorder.recording) return;
    if (stopping || !tc.text.outro) { tc.cancel(); stopping = false; recorder.stop(); return; }
    stopping = true; // second press stops immediately
    recStatus.textContent = 'Adding the closing card… (press ⏺ again to stop right away)';
    await tc.play('outro', 4.5);
    if (stopping && recorder.recording) recorder.stop();
    stopping = false;
  };

  recorder.onstate = (state, info) => {
    recBtn.classList.toggle('on', state === 'recording');
    $('recBadge').hidden = state !== 'recording';
    if (state === 'recording') {
      recStatus.textContent = wholeShow
        ? 'Recording the whole show… it stops by itself at the end (or press ⏺ / R).'
        : 'Recording… press ⏺ or R to stop.';
      $('recResult').hidden = true;
    } else {
      app.setRenderSize(null);
      if (wholeShow) { show.loop = savedLoop; wholeShow = false; }
    }
    if (state === 'done') {
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = info.url;
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      const name = `skylights-show-${stamp}.${info.ext}`;
      $('recVideo').src = info.url;
      const dl = $('recDownload');
      dl.href = info.url;
      dl.download = name;
      const mb = (info.blob.size / 1048576).toFixed(1);
      recStatus.textContent = `Done: ${Math.round(info.seconds)} s video, ${mb} MB.`;
      $('recResult').hidden = false;
      const file = new File([info.blob], name, { type: info.mime });
      const canShare = navigator.canShare?.({ files: [file] });
      $('recShare').hidden = !canShare;
      $('recShare').onclick = () => navigator.share({ files: [file], title: 'Drone light show' }).catch(() => {});
      // open the Video tab so the result is visible
      document.querySelector('.tabs [data-tab="video"]').click();
      setPanel(true);
    }
    if (state === 'error') recStatus.textContent = info.message;
  };

  show.on((type) => {
    // whole-show recording ends when the (non-looping) show finishes
    if (type === 'play' && wholeShow && recorder.recording && !show.playing && !tc.playing && show.index === show.steps.length - 1) setTimeout(stopRecording, 800);
  });

  $('btnRecShow').onclick = () => startRecording(true);
  $('btnRecNow').onclick = () => startRecording(false);
  recBtn.onclick = () => (recorder.recording ? stopRecording() : startRecording(false));

  // ---------- Install on home screen ----------
  const installBtns = [$('btnInstall'), $('btnInstall2')];
  const installHint = $('installHint');
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;
  const showInstall = (on) => installBtns.forEach((b) => (b.hidden = !on));
  if (standalone) installHint.textContent = '✓ SkyLights is installed — you are using the app.';
  else if (isIOS) installHint.textContent = 'On iPhone / iPad: open this page in Safari, tap the Share button (□↑), then “Add to Home Screen”.';
  else installHint.textContent = 'On Android: use the button above, or Chrome menu ⋮ → “Install app” / “Add to Home screen”. (Installing needs the app to be opened from an https:// address.)';
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstall(true);
    installHint.textContent = 'Add SkyLights to your home screen — it opens full-screen and works offline.';
  });
  const doInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    showInstall(false);
  };
  installBtns.forEach((b) => (b.onclick = doInstall));
  window.addEventListener('appinstalled', () => {
    showInstall(false);
    installHint.textContent = '✓ Installed! Open SkyLights from your home screen.';
  });

  // ---------- Keyboard ----------
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); show.setPlaying(!show.playing); }
    else if (e.code === 'ArrowRight') show.next();
    else if (e.code === 'ArrowLeft') show.prev();
    else if (e.code === 'KeyG') app.fireVolley();
    else if (e.code === 'KeyR') recBtn.click();
    else if (e.code === 'KeyB') app.launchBalloon();
    else if (e.code === 'KeyH') setHidden(!document.body.classList.contains('ui-hidden'));
    else if (e.code === 'KeyF') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });

  renderList();
  syncPlay();

  const bar = $('progressBar');
  return {
    frame() {
      bar.style.width = `${(show.progress * 100).toFixed(1)}%`;
      if (recorder.recording) {
        const s = Math.floor(recorder.elapsed);
        $('recTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      }
      if (activeTab === 'music' && panel.classList.contains('open')) drawMeter();
    },
  };
}

/** Downscale an uploaded image to a small data URL (keeps localStorage small). */
function shrinkImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
