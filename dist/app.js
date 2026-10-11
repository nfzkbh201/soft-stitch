(function () {
  'use strict';
  const T = StitchTimer, E = Embroidery, $ = selector => document.querySelector(selector);
  const key = 'soft-stitch:v1';
  const patternNames = E.names;
  const paletteNames = { rose: 'Rose / olive / butter', blue: 'Cornflower / sage / honey', peach: 'Peach / fern / marigold' };
  let saved = {}, storageAvailable = true;
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { storageAvailable = false; }
  let timer = T.restore(saved.timer), sound = saved.sound === true;
  let pieces = Array.isArray(saved.pieces) ? saved.pieces.filter(p => p && typeof p.id === 'string' && patternNames[p.pattern] && E.palettes[p.palette] && T.validMinutes(p.minutes) && Number.isFinite(p.completedAt)).slice(0, 365) : [];
  let previewStart = null, lastFrame = -1, lastSecond = null, lastStatus = null, lastRenderedStitch = -1, toastTimeout, audioContext, selectedPiece;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const hoop = $('#hoop');

  function icon(name) {
    const element = document.createElement('i');
    element.dataset.lucide = name; element.setAttribute('aria-hidden', 'true');
    return element;
  }
  function icons() { if (window.lucide) lucide.createIcons({ attrs: { 'aria-hidden': 'true' } }); }
  function message(text) {
    const toast = $('#toast'); toast.textContent = text; toast.hidden = false;
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { toast.hidden = true; }, 5000);
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify({ timer, pieces, sound })); }
    catch { if (storageAvailable) message('Your browser could not save this session. You can still keep a picture when it finishes.'); storageAvailable = false; }
  }
  function sameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }
  function updateTotals() {
    const total = pieces.filter(p => sameDay(p.completedAt, Date.now())).reduce((sum,p) => sum + Number(p.minutes), 0);
    $('#today-minutes').textContent = total + (total === 1 ? ' minute' : ' minutes');
    $('#collection-count').textContent = pieces.length;
    $('#collection-total').textContent = pieces.length + (pieces.length === 1 ? ' piece stitched' : ' pieces stitched');
    $('#today').textContent = new Intl.DateTimeFormat(undefined, { weekday:'long', day:'numeric', month:'long' }).format(new Date());
  }
  function setMainButton(name, label) {
    const span = document.createElement('span'); span.textContent = label;
    $('#start-button').replaceChildren(icon(name), span); icons();
  }
  function updateControls() {
    const locked = timer.status === 'running' || timer.status === 'paused';
    document.querySelectorAll('[data-pattern], [data-palette], [data-duration], #minutes, #intention').forEach(el => { el.disabled = locked; });
    document.querySelectorAll('[data-pattern]').forEach(el => {
      const selected = el.dataset.pattern === timer.pattern;
      el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', selected);
    });
    document.querySelectorAll('[data-palette]').forEach(el => {
      const selected = el.dataset.palette === timer.palette;
      el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', selected);
    });
    document.querySelectorAll('[data-duration]').forEach(el => {
      const selected = Number(el.dataset.duration) === timer.minutes;
      el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', selected);
    });
    $('#minutes').value = timer.minutes; $('#intention').value = timer.intention;
    $('#thread-name').textContent = paletteNames[timer.palette];
    $('#pattern-number').textContent = 'PATTERN NO. 0' + (Object.keys(patternNames).indexOf(timer.pattern) + 1);
    $('#reset-button').disabled = timer.status === 'idle';
    $('#preview-button').disabled = locked;
    $('#sound-toggle').setAttribute('aria-pressed', sound);
    $('#sound-toggle').setAttribute('aria-label', sound ? 'Mute completion sound' : 'Enable completion sound');
    $('#sound-toggle').title = sound ? 'Mute completion sound' : 'Enable completion sound';
    $('#sound-toggle').replaceChildren(icon(sound ? 'volume-2' : 'volume-x'));
    const states = { idle: ['play','Start stitching','A moment for you','On the hoop'], running: ['pause','Pause stitching','A little time for yourself','Stitching in progress'], paused: ['play','Keep stitching','Take your time','Resting a moment'], completed: ['plus','Make another','Beautifully done','A finished little piece'] };
    const [buttonIcon,buttonText,status,stage] = states[timer.status];
    setMainButton(buttonIcon,buttonText);
    $('#session-status').textContent = status; $('#stage-state').textContent = stage;
    document.querySelectorAll('[data-thumbnail]').forEach(canvas => E.draw(canvas,canvas.dataset.thumbnail,timer.palette,1,{thumbnail:true}));
    lastRenderedStitch = -1; lastSecond = null; lastStatus = timer.status;
    updateTotals(); icons();
  }
  function resetTimer() {
    timer = T.fresh(timer.minutes,timer.pattern,timer.palette);
    previewStart = null; save(); updateControls(); tick();
  }
  function setDuration(value) {
    if (!T.validMinutes(value)) { $('#duration-error').hidden = false; $('#minutes').setAttribute('aria-invalid','true'); return false; }
    $('#duration-error').hidden = true; $('#minutes').removeAttribute('aria-invalid');
    timer = { ...T.fresh(Number(value),timer.pattern,timer.palette), intention: timer.intention };
    save(); updateControls(); tick(); return true;
  }
  function unlockAudio() {
    if (!sound) return;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume().catch(() => {}); } catch { /* Sound is optional; the timer works without an audio device. */ }
  }
  function chime() {
    if (!sound || !audioContext || audioContext.state !== 'running') return;
    [523.25,659.25,783.99].forEach((frequency,i) => {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), start = audioContext.currentTime + i*.16;
      oscillator.type='sine'; oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.08,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.9);
      oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+1);
    });
  }
  function showFinished(piece) {
    selectedPiece=piece;
    E.draw($('#finished-piece'),piece.pattern,piece.palette,1);
    $('#finish-detail').textContent=piece.minutes+' minutes of focus. '+patternNames[piece.pattern]+', yours to keep.';
    if (!$('#finish-dialog').open) $('#finish-dialog').showModal();
  }
  function complete() {
    const completedAt=timer.deadline || Date.now();
    timer=T.finish(timer);
    let piece=pieces.find(p=>p.id===timer.id);
    if (!piece) { piece={id:timer.id,pattern:timer.pattern,palette:timer.palette,minutes:timer.minutes,intention:timer.intention,completedAt};pieces.unshift(piece);pieces=pieces.slice(0,365); }
    save();updateControls();renderCollection();chime();showFinished(piece);
  }
  function tick(now=Date.now()) {
    if (timer.status==='running' && T.remaining(timer,now)<=0) complete();
    if (lastStatus!==timer.status) updateControls();
    const seconds=Math.ceil(T.remaining(timer,now)/1000);
    if(seconds!==lastSecond){
      const minutes=String(Math.floor(seconds/60)).padStart(2,'0'), remainder=String(seconds%60).padStart(2,'0');
      $('#timer-display').innerHTML=minutes+'<span>:</span>'+remainder;
      $('#timer-display').setAttribute('aria-label',Math.floor(seconds/60)+' minutes and '+seconds%60+' seconds remaining');
      document.title=timer.status==='running'?minutes+':'+remainder+' - Soft Stitch':'Soft Stitch - a little time, a little thread';
      lastSecond=seconds;
    }
    const progress=T.progress(timer,now),design=E.pattern(timer.pattern,timer.palette);
    $('#progress-bar').style.width=(progress*100)+'%';
    $('#stitch-caption').textContent=patternNames[timer.pattern];
    $('#stitch-progress').textContent=timer.status==='idle'?'Made with a little patience':Math.floor(design.stitches.length*progress).toLocaleString()+' / '+design.stitches.length.toLocaleString()+' stitches';
    $('#progress-note').textContent=timer.status==='completed'?'A finished piece. A little time for you.':timer.status==='paused'?'Your thread will be right here.':timer.status==='running'?Math.floor(progress*100)+'% stitched. One moment at a time.':'One stitch at a time.';
  }
  function frame(now) {
    if (now-lastFrame>80 && !document.hidden && !$('#studio').hidden) {
      const isPreview=previewStart!==null;
      let progress=isPreview?Math.min(1,(now-previewStart)/6500):timer.status==='idle'?1:T.progress(timer);
      const count=Math.floor(E.pattern(timer.pattern,timer.palette).stitches.length*progress);
      const active=(isPreview||timer.status==='running')&&!reducedMotion.matches;
      if(count!==lastRenderedStitch||active){
        E.draw(hoop,timer.pattern,timer.palette,progress,{active,time:now});lastRenderedStitch=count;
        hoop.setAttribute('aria-label',patternNames[timer.pattern]+' embroidery, '+Math.round(progress*100)+' percent stitched');
      }
      if(isPreview){$('#stage-state').textContent='A little preview';if(progress>=1){previewStart=null;$('#stage-state').textContent='On the hoop';}}
      lastFrame=now;
    }
    requestAnimationFrame(frame);
  }
  function download(piece) {
    const output=document.createElement('canvas');output.width=1200;output.height=1400;
    const ctx=output.getContext('2d');ctx.fillStyle='#faf5f5';ctx.fillRect(0,0,1200,1400);
    const embroidered=document.createElement('canvas');embroidered.width=1200;embroidered.height=1200;
    E.draw(embroidered,piece.pattern,piece.palette,1);ctx.drawImage(embroidered,0,30);
    ctx.textAlign='center';ctx.fillStyle='#71374a';ctx.font='42px Georgia';ctx.fillText(patternNames[piece.pattern],600,1220);
    ctx.font='24px sans-serif';ctx.fillStyle='#87797f';ctx.fillText(piece.minutes+' minutes of time for myself / '+new Date(piece.completedAt).toLocaleDateString(),600,1270);
    ctx.font='italic 24px Georgia';ctx.fillText('soft stitch.',600,1330);
    output.toBlob(blob=>{if(!blob){message('The picture could not be created. Please try again.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='soft-stitch-'+piece.pattern+'-'+new Date(piece.completedAt).toISOString().slice(0,10)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);},'image/png');
  }
  function renderCollection() {
    $('#collection-grid').replaceChildren();$('#empty-collection').hidden=pieces.length>0;
    for(const piece of pieces){
      const card=document.createElement('article');card.className='piece-card';
      const canvas=document.createElement('canvas');canvas.width=560;canvas.height=560;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',patternNames[piece.pattern]+' completed embroidery');E.draw(canvas,piece.pattern,piece.palette,1);
      const heading=document.createElement('h2');heading.textContent=patternNames[piece.pattern];
      const date=document.createElement('p');date.textContent=new Date(piece.completedAt).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'});
      card.append(canvas,heading,date);
      if(piece.intention){const note=document.createElement('p');note.className='piece-intention';note.textContent=piece.intention;card.append(note);}
      const actions=document.createElement('div');actions.className='piece-actions';const duration=document.createElement('span');duration.textContent=piece.minutes+' minutes, well spent';
      const buttons=document.createElement('div');const exportButton=document.createElement('button');exportButton.className='icon-button';exportButton.title='Download embroidery';exportButton.setAttribute('aria-label','Download '+patternNames[piece.pattern]);exportButton.append(icon('download'));exportButton.addEventListener('click',()=>download(piece));
      const remove=document.createElement('button');remove.className='icon-button';remove.title='Remove from collection';remove.setAttribute('aria-label','Remove '+patternNames[piece.pattern]);remove.append(icon('trash-2'));remove.addEventListener('click',()=>{if(!confirm('Remove this embroidery from your collection?'))return;pieces=pieces.filter(p=>p.id!==piece.id);save();renderCollection();updateTotals();});
      buttons.append(exportButton,remove);actions.append(duration,buttons);card.append(actions);$('#collection-grid').append(card);
    }
    updateTotals();icons();
  }
  function navigate() {
    const collection=location.hash==='#collection';
    $('#studio').hidden=collection;$('#collection').hidden=!collection;
    document.querySelectorAll('[data-view]').forEach(el=>{const active=el.dataset.view===(collection?'collection':'studio');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if(collection) renderCollection();lastRenderedStitch=-1;
  }
  document.querySelectorAll('[data-pattern]').forEach(button=>button.addEventListener('click',()=>{timer={...T.fresh(timer.minutes,button.dataset.pattern,timer.palette),intention:timer.intention};previewStart=null;save();updateControls();tick();}));
  document.querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',()=>{timer={...T.fresh(timer.minutes,timer.pattern,button.dataset.palette),intention:timer.intention};previewStart=null;save();updateControls();tick();}));
  document.querySelectorAll('[data-duration]').forEach(button=>button.addEventListener('click',()=>setDuration(button.dataset.duration)));
  $('#minutes').addEventListener('change',event=>setDuration(event.target.value));
  $('#intention').addEventListener('input',event=>{timer.intention=event.target.value;save();});
  $('#start-button').addEventListener('click',()=>{
    previewStart=null;unlockAudio();
    if(timer.status==='completed'){resetTimer();return;}
    if(timer.status==='running'){
      if(T.remaining(timer)<=0){complete();return;}
      timer=T.pause(timer);
    }else{
      if(timer.status==='idle'&&!setDuration($('#minutes').value))return;
      timer=T.start(timer,Date.now(),window.crypto?.randomUUID?.()||Date.now().toString(36));
    }
    save();updateControls();tick();
  });
  $('#reset-button').addEventListener('click',()=>{if(timer.status==='completed'||confirm('Start this piece over? The stitches in this session will be cleared.'))resetTimer();});
  $('#preview-button').addEventListener('click',()=>{previewStart=performance.now();lastRenderedStitch=-1;});
  $('#sound-toggle').addEventListener('click',()=>{sound=!sound;unlockAudio();save();updateControls();if(sound)chime();});
  $('#close-finish').addEventListener('click',()=>$('#finish-dialog').close());
  $('#download-finished').addEventListener('click',()=>{if(selectedPiece)download(selectedPiece);});
  $('#view-collection').addEventListener('click',()=>{$('#finish-dialog').close();location.hash='collection';});
  window.addEventListener('hashchange',navigate);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();updateTotals();lastRenderedStitch=-1;}});
  window.addEventListener('storage',event=>{
    if(event.key!==key||!event.newValue)return;
    try{const state=JSON.parse(event.newValue);timer=T.restore(state.timer);sound=state.sound===true;pieces=Array.isArray(state.pieces)?state.pieces.filter(p=>p&&typeof p.id==='string'&&patternNames[p.pattern]&&E.palettes[p.palette]&&T.validMinutes(p.minutes)&&Number.isFinite(p.completedAt)).slice(0,365):[];previewStart=null;updateControls();tick();if(!$('#collection').hidden)renderCollection();}catch{ /* Ignore incomplete data from another tab. */ }
  });
  updateControls();navigate();tick();requestAnimationFrame(frame);setInterval(()=>tick(),400);
  if(!storageAvailable)message('Browser storage is unavailable. Keep this tab open; finished pieces can still be downloaded.');
})();
