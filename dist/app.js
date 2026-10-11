(function () {
  'use strict';
  const T = StitchTimer, E = Embroidery, D = StitchData, $ = selector => document.querySelector(selector);
  const key = 'soft-stitch:v1'; // Migrate existing sessions in place.
  const paletteNames = { rose: 'Rose / olive / butter', blue: 'Cornflower / sage / honey', peach: 'Peach / fern / marigold', custom: 'Your own little colour story' };
  const colourInputs = ['#colour-main', '#colour-accent', '#colour-leaf'];
  let storageAvailable = true, saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { storageAvailable = false; }
  let timer = T.restore(saved.timer), sound = saved.sound === true, preferences = D.preferences(saved.preferences);
  let pieces = D.readPieces(saved.pieces);
  let previewStart = null, lastFrame = -1, lastSecond = null, lastRendered = '', toastTimeout, audioContext, selectedPiece;
  let collectionView = 'pieces', calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12), selectedDay = null, visiblePieces = 24;
  let miniWindow = null, miniCanvas = null, miniRender = '', miniOpening = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)'), hoop = $('#hoop');
  const uid = () => window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const pieceName = piece => E.title(piece.pattern, piece.design);
  const inMonth = piece => { const date = new Date(piece.completedAt); return date.getFullYear() === calendarMonth.getFullYear() && date.getMonth() === calendarMonth.getMonth(); };

  function icon(name) {
    const element = document.createElement('i'); element.dataset.lucide = name; element.setAttribute('aria-hidden', 'true'); return element;
  }
  function icons() { if (window.lucide) lucide.createIcons({ attrs: { 'aria-hidden': 'true' } }); }
  function buttonContent(button, name, label) {
    const span = document.createElement('span'); span.textContent = label; button.replaceChildren(icon(name), span);
  }
  function message(text) {
    $('#toast').textContent = text; $('#toast').hidden = false;
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 6500);
  }
  function latestPieces() {
    if (!storageAvailable) return pieces;
    try { const current = JSON.parse(localStorage.getItem(key)); return Array.isArray(current?.pieces) ? D.readPieces(current.pieces) : pieces; }
    catch { return pieces; }
  }
  function save({ add = [], remove = null, requireStorage = false } = {}) {
    const next = D.merge(latestPieces(), add).filter(piece => piece.id !== remove);
    try {
      localStorage.setItem(key, JSON.stringify({ version: 2, timer, pieces: next, sound, preferences })); storageAvailable = true;
    } catch {
      storageAvailable = false;
      message(requireStorage ? 'There is not enough browser storage. Nothing was imported; export a backup before trying again.' : 'Browser storage is unavailable. Keep this tab open and export your collection to keep it.');
      if (requireStorage) return false;
    }
    pieces = next; return true;
  }
  function updateTotals() {
    const total = pieces.filter(p => D.dayKey(p.completedAt) === D.dayKey(Date.now())).reduce((sum,p) => sum + p.minutes, 0);
    $('#today-minutes').textContent = total + (total === 1 ? ' minute' : ' minutes');
    $('#collection-count').textContent = pieces.length;
    $('#collection-total').textContent = pieces.length + (pieces.length === 1 ? ' piece stitched' : ' pieces stitched');
    $('#today').textContent = new Intl.DateTimeFormat(undefined, { weekday:'long', day:'numeric', month:'long' }).format(new Date());
  }
  function mainAction() {
    if (timer.mode === 'break') return { idle:['play','Start break'], running:['pause','Pause break'], paused:['play','Continue break'], completed:['scissors','Back to stitching'] }[timer.status];
    return { idle:['play','Start stitching'], running:['pause','Pause stitching'], paused:['play','Keep stitching'], completed:['plus','Make another'] }[timer.status];
  }
  function canBreak() { return timer.mode === 'focus' && timer.status === 'completed' && preferences.breakMinutes > 0; }
  function updateControls() {
    const locked = timer.status === 'running' || timer.status === 'paused' || timer.mode === 'break';
    document.querySelectorAll('[data-pattern], [data-palette], [data-duration], #minutes, #intention, #initials, #birth-month, .custom-threads input').forEach(el => { el.disabled = locked; });
    for (const [attribute,value] of [['pattern',timer.pattern],['palette',timer.palette],['duration',String(timer.focusMinutes)]]) {
      document.querySelectorAll('[data-'+attribute+']').forEach(el => {
        const selected = el.dataset[attribute] === value; el.classList.toggle('selected',selected); el.setAttribute('aria-pressed',String(selected));
      });
    }
    $('#minutes').value = timer.focusMinutes; $('#intention').value = timer.intention;
    $('#initials').value = timer.design.initials; $('#birth-month').value = timer.design.month;
    $('#initials-field').hidden = timer.pattern !== 'initials'; $('#birth-field').hidden = timer.pattern !== 'birthflower';
    $('#custom-threads').hidden = timer.palette !== 'custom';
    colourInputs.forEach((selector,i) => { $(selector).value = timer.design.colours[i]; });
    $('#thread-name').textContent = paletteNames[timer.palette];
    $('#pattern-number').textContent = 'PATTERN NO. 0' + (D.patterns.indexOf(timer.pattern)+1);
    $('#reset-button').disabled = timer.status === 'idle'; $('#preview-button').disabled = locked;
    $('#sound-toggle').setAttribute('aria-pressed',String(sound));
    $('#sound-toggle').setAttribute('aria-label',sound ? 'Mute completion sound' : 'Enable completion sound');
    $('#sound-toggle').title = sound ? 'Mute completion sound' : 'Enable completion sound';
    $('#sound-toggle').replaceChildren(icon(sound ? 'volume-2' : 'volume-x'));
    buttonContent($('#start-button'), ...mainAction());
    const statuses = { idle:['A moment for you','On the hoop'], running:['A little time for yourself','Stitching in progress'], paused:['Take your time','Resting a moment'], completed:['Beautifully done','A finished little piece'] };
    const [status,stage] = statuses[timer.status];
    $('#session-status').textContent = timer.mode === 'break' ? timer.status === 'completed' ? 'Ready when you are' : 'A little room to breathe' : status;
    $('#stage-state').textContent = timer.mode === 'break' ? 'Let the thread rest' : stage;
    $('#session-badge').textContent = timer.mode === 'break' ? 'BREAK' : 'FOCUS';
    $('#take-break').hidden = !canBreak(); $('#finish-break').hidden = !canBreak();
    $('#take-break span').textContent = $('#finish-break span').textContent = 'Take a '+preferences.breakMinutes+'-minute break';
    $('#break-length').value = preferences.breakMinutes;
    $('#notifications').checked = preferences.notifications && 'Notification' in window && Notification.permission === 'granted';
    $('#notifications').disabled = !('Notification' in window) || !isSecureContext;
    $('#notification-note').textContent = !('Notification' in window) || !isSecureContext ? 'Notifications are unavailable in this browser. Completion still appears in the studio.' : Notification.permission === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Notifications arrive while the studio is open. A sleeping device may delay them.';
    document.querySelectorAll('[data-thumbnail]').forEach(canvas => E.draw(canvas,canvas.dataset.thumbnail,timer.palette,1,{thumbnail:true,design:timer.design}));
    lastRendered = ''; miniRender = ''; lastSecond = null; updateTotals(); icons(); syncMini();
  }
  function newFocus(changes = {}) {
    return { ...T.fresh(timer.focusMinutes,timer.pattern,timer.palette,timer.design), intention:timer.intention, ...changes };
  }
  function resetTimer() { timer = newFocus({intention:''}); previewStart = null; save(); updateControls(); tick(); }
  function setDuration(value) {
    if (!T.validMinutes(value)) { $('#duration-error').hidden=false; $('#minutes').setAttribute('aria-invalid','true'); return false; }
    $('#duration-error').hidden=true; $('#minutes').removeAttribute('aria-invalid');
    timer={...T.fresh(Number(value),timer.pattern,timer.palette,timer.design),intention:timer.intention};
    save(); updateControls(); tick(); return true;
  }
  function unlockAudio() {
    if (!sound) return;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state==='suspended') audioContext.resume().catch(()=>{}); } catch { /* Audio remains optional. */ }
  }
  function chime() {
    if (!sound || !audioContext || audioContext.state!=='running') return;
    [523.25,659.25,783.99].forEach((frequency,i)=>{
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime+i*.16;
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.08,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.9);
      oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+1);
    });
  }
  function notify(title,body) {
    if (!preferences.notifications || !('Notification' in window) || Notification.permission!=='granted') return;
    try { const note=new Notification(title,{body,icon:new URL('assets/favicon.png',location.href).href,tag:'soft-stitch-'+timer.id});note.onclick=()=>{window.focus();note.close();}; }
    catch { message('Your session is finished. This browser could not show a system notification.'); }
  }
  function showFinished(piece) {
    selectedPiece=piece;E.draw($('#finished-piece'),piece.pattern,piece.palette,1,{design:piece.design});
    $('#finish-detail').textContent=piece.minutes+' minutes of focus. '+pieceName(piece)+', yours to keep.';
    if(!$('#finish-dialog').open)$('#finish-dialog').showModal();
  }
  function complete() {
    const completedAt=timer.deadline || Date.now(),isBreak=timer.mode==='break';
    const alreadySaved=latestPieces().some(piece=>piece.id===timer.id);timer=T.finish(timer);
    if(isBreak){save();updateControls();chime();notify('A little break, beautifully spent.','Ready for another piece?');message('Your break is finished. Ready when you are.');return;}
    const piece=D.piece({id:timer.id,pattern:timer.pattern,palette:timer.palette,minutes:timer.minutes,intention:timer.intention,design:timer.design,completedAt});
    save({add:piece?[piece]:[]});updateControls();if(!$('#collection').hidden)renderCollection();
    if(piece&&!alreadySaved){chime();notify('Look what you made.',piece.minutes+' minutes of focus. Your embroidery is in your collection.');showFinished(piece);}
  }
  function tick(now=Date.now()) {
    if(timer.status==='running'&&T.remaining(timer,now)<=0)complete();
    const seconds=Math.ceil(T.remaining(timer,now)/1000),minutes=String(Math.floor(seconds/60)).padStart(2,'0'),remainder=String(seconds%60).padStart(2,'0');
    if(seconds!==lastSecond){
      $('#timer-display').innerHTML=minutes+'<span>:</span>'+remainder;
      $('#timer-display').setAttribute('aria-label',Math.floor(seconds/60)+' minutes and '+seconds%60+' seconds remaining');
      document.title=timer.status==='running'?minutes+':'+remainder+' - '+(timer.mode==='break'?'Break - ':'')+'Soft Stitch':'Soft Stitch - a little time, a little thread';lastSecond=seconds;
    }
    const progress=T.progress(timer,now),design=E.pattern(timer.pattern,timer.palette,timer.design);
    $('#progress-bar').style.width=progress*100+'%';$('#stitch-caption').textContent=pieceName(timer);
    $('#stitch-progress').textContent=timer.mode==='break'?'A moment to recharge':timer.status==='idle'?'Made with a little patience':Math.floor(design.stitches.length*progress).toLocaleString()+' / '+design.stitches.length.toLocaleString()+' stitches';
    $('#progress-note').textContent=timer.mode==='break'?timer.status==='completed'?'Back to the hoop, whenever you like.':'Let your shoulders drop. There is no hurry.':timer.status==='completed'?'A finished piece. A little time for you.':timer.status==='paused'?'Your thread will be right here.':timer.status==='running'?Math.floor(progress*100)+'% stitched. One moment at a time.':'One stitch at a time.';
    if(miniWindow&&!miniWindow.closed){const label=miniWindow.document.querySelector('.mini-time');if(label){label.textContent=minutes+':'+remainder;label.setAttribute('aria-label',$('#timer-display').getAttribute('aria-label'));drawMini();}}
  }
  function visualProgress() { return timer.mode==='break'||timer.status==='idle'?1:T.progress(timer); }
  function frame(now) {
    if(now-lastFrame>50&&!document.hidden&&!$('#studio').hidden){
      const preview=previewStart!==null,progress=preview?Math.min(1,(now-previewStart)/8500):visualProgress();
      const active=(preview||(timer.status==='running'&&timer.mode==='focus'))&&!reducedMotion.matches;
      const count=Math.floor(E.pattern(timer.pattern,timer.palette,timer.design).stitches.length*progress);
      const signature=timer.pattern+timer.palette+JSON.stringify(timer.design)+count;
      if(signature!==lastRendered||active){E.draw(hoop,timer.pattern,timer.palette,progress,{active,design:timer.design});lastRendered=signature;hoop.setAttribute('aria-label',pieceName(timer)+' embroidery, '+Math.round(progress*100)+' percent stitched');}
      if(preview){$('#stage-state').textContent='A little preview';if(progress>=1){previewStart=null;$('#stage-state').textContent='On the hoop';}}lastFrame=now;
    }
    requestAnimationFrame(frame);
  }
  function saveBlob(blob,name) {
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function download(piece) {
    const output=document.createElement('canvas');output.width=1200;output.height=1400;
    const ctx=output.getContext('2d');ctx.fillStyle='#faf5f5';ctx.fillRect(0,0,1200,1400);
    const embroidered=document.createElement('canvas');embroidered.width=1200;embroidered.height=1200;
    E.draw(embroidered,piece.pattern,piece.palette,1,{design:piece.design});ctx.drawImage(embroidered,0,30);
    ctx.textAlign='center';ctx.fillStyle='#71374a';ctx.font='42px Georgia';ctx.fillText(pieceName(piece),600,1220);
    ctx.font='24px sans-serif';ctx.fillStyle='#87797f';ctx.fillText(piece.minutes+' minutes of time for myself / '+new Date(piece.completedAt).toLocaleDateString(),600,1270);
    ctx.font='italic 24px Georgia';ctx.fillText('soft stitch.',600,1330);
    output.toBlob(blob=>{if(blob)saveBlob(blob,'soft-stitch-'+piece.pattern+'-'+D.dayKey(piece.completedAt)+'.png');else message('The picture could not be created. Please try again.');},'image/png');
  }
  function renderCalendar() {
    $('#calendar-month').textContent=calendarMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const monthPieces=pieces.filter(inMonth),weekStart=new Date();weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-(weekStart.getDay()+6)%7);
    const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+7);
    $('#month-total').textContent=monthPieces.reduce((n,p)=>n+p.minutes,0)+' minutes this month';
    $('#week-total').textContent=pieces.filter(p=>p.completedAt>=weekStart.getTime()&&p.completedAt<weekEnd.getTime()).reduce((n,p)=>n+p.minutes,0)+' minutes this week';
    const byDay=new Map();for(const piece of monthPieces){const date=D.dayKey(piece.completedAt);if(!byDay.has(date))byDay.set(date,[]);byDay.get(date).push(piece);}
    $('#calendar-days').replaceChildren();
    for(const day of D.monthDays(calendarMonth.getFullYear(),calendarMonth.getMonth())){
      const daily=byDay.get(day.key)||[],button=document.createElement('button');
      button.className='calendar-day'+(!day.inMonth?' outside':'')+(daily.length?' has-piece':'')+(day.key===D.dayKey(Date.now())?' is-today':'');
      button.disabled=!day.inMonth;button.setAttribute('aria-pressed',String(selectedDay===day.key));button.dataset.date=day.key;
      const label=new Date(day.key+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'});
      button.setAttribute('aria-label',label+', '+daily.length+(daily.length===1?' piece':' pieces')+', '+daily.reduce((n,p)=>n+p.minutes,0)+' minutes');
      const number=document.createElement('span');number.className='day-number';number.textContent=day.day;button.append(number);
      if(daily.length){const canvas=document.createElement('canvas');canvas.width=180;canvas.height=180;canvas.setAttribute('aria-hidden','true');E.draw(canvas,daily[0].pattern,daily[0].palette,1,{thumbnail:true,design:daily[0].design});button.append(canvas);if(daily.length>1){const count=document.createElement('span');count.className='day-count';count.textContent='+'+(daily.length-1);button.append(count);}}
      button.addEventListener('click',()=>{selectedDay=day.key;visiblePieces=24;renderCollection();$('#calendar-days [data-date="'+day.key+'"]').focus({preventScroll:true});});$('#calendar-days').append(button);
    }
    $('#day-title').textContent=selectedDay?new Date(selectedDay+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}):"This month's stitches";$('#show-month').hidden=!selectedDay;
  }
  function renderCollection() {
    $('#collection-grid').replaceChildren();$('#calendar-view').hidden=collectionView!=='calendar';$('#empty-collection').hidden=pieces.length>0||collectionView==='calendar';
    document.querySelectorAll('[data-collection-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.collectionView===collectionView)));
    if(collectionView==='calendar')renderCalendar();
    const filtered=collectionView==='calendar'?pieces.filter(p=>inMonth(p)&&(!selectedDay||D.dayKey(p.completedAt)===selectedDay)):pieces;
    $('#empty-day').hidden=filtered.length>0;$('#load-more').hidden=filtered.length<=visiblePieces;
    for(const piece of filtered.slice(0,visiblePieces)){
      const card=document.createElement('article');card.className='piece-card';
      const canvas=document.createElement('canvas');canvas.width=560;canvas.height=560;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',pieceName(piece)+' completed embroidery');E.draw(canvas,piece.pattern,piece.palette,1,{design:piece.design});
      const heading=document.createElement('h2');heading.textContent=pieceName(piece);
      const date=document.createElement('p');date.textContent=new Date(piece.completedAt).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'});card.append(canvas,heading,date);
      if(piece.intention){const note=document.createElement('p');note.className='piece-intention';note.textContent=piece.intention;card.append(note);}
      const actions=document.createElement('div');actions.className='piece-actions';const duration=document.createElement('span');duration.textContent=piece.minutes+' minutes, well spent';
      const buttons=document.createElement('div'),exportButton=document.createElement('button');exportButton.className='icon-button';exportButton.title='Download embroidery';exportButton.setAttribute('aria-label','Download '+pieceName(piece));exportButton.append(icon('download'));exportButton.addEventListener('click',()=>download(piece));
      const remove=document.createElement('button');remove.className='icon-button';remove.title='Remove from collection';remove.setAttribute('aria-label','Remove '+pieceName(piece));remove.append(icon('trash-2'));remove.addEventListener('click',()=>{if(!confirm('Remove this embroidery from your collection?'))return;save({remove:piece.id});renderCollection();});
      buttons.append(exportButton,remove);actions.append(duration,buttons);card.append(actions);$('#collection-grid').append(card);
    }
    updateTotals();icons();
  }
  function navigate() {
    const collection=location.hash==='#collection';$('#studio').hidden=collection;$('#collection').hidden=!collection;
    document.querySelectorAll('[data-view]').forEach(el=>{const active=el.dataset.view===(collection?'collection':'studio');el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if(collection)renderCollection();lastRendered='';
  }
  function startPause() {
    previewStart=null;unlockAudio();
    if(timer.status==='completed'){resetTimer();return;}
    if(timer.status==='running'){if(T.remaining(timer)<=0){complete();return;}timer=T.pause(timer);}
    else{if(timer.status==='idle'&&(!validateInitials()||!setDuration($('#minutes').value)))return;timer=T.start(timer,Date.now(),uid());}
    save();updateControls();tick();
  }
  function startBreak() {
    if(!canBreak())return;
    $('#finish-dialog').close();timer=T.takeBreak(timer,preferences.breakMinutes,Date.now(),uid());previewStart=null;
    save();updateControls();tick();location.hash='studio';
  }
  function validateInitials() {
    const valid=timer.pattern!=='initials'||/^[a-z]{1,3}$/i.test($('#initials').value.trim());
    $('#initials-error').hidden=valid;$('#initials').setAttribute('aria-invalid',String(!valid));return valid;
  }
  function updateDesign(changes) { timer=newFocus({design:D.design({...timer.design,...changes})});previewStart=null;save();updateControls();tick(); }
  function syncMini() {
    if(!miniWindow||miniWindow.closed||!miniWindow.document.querySelector('.mini-start'))return;
    const doc=miniWindow.document;
    // Reuse rendered icons; the mini window shares the parent timer controller.
    doc.querySelector('.mini-start').innerHTML=$('#start-button').innerHTML;
    doc.querySelector('.mini-sound').innerHTML=$('#sound-toggle').innerHTML;
    doc.querySelector('.mini-sound').setAttribute('aria-label',$('#sound-toggle').getAttribute('aria-label'));
    doc.querySelector('.mini-sound').setAttribute('aria-pressed',String(sound));
    doc.querySelector('.mini-status').textContent=$('#session-status').textContent;
    doc.querySelector('.mini-pattern').textContent=pieceName(timer);
    doc.querySelector('.mini-break').hidden=!canBreak();doc.querySelector('.mini-break').textContent='Take a '+preferences.breakMinutes+'-minute break';
  }
  function drawMini() {
    if(!miniWindow||miniWindow.closed||!miniCanvas)return;
    const progress=visualProgress(),signature=timer.pattern+timer.palette+JSON.stringify(timer.design)+Math.floor(progress*1000);
    if(signature===miniRender)return;
    E.draw(miniCanvas,timer.pattern,timer.palette,progress,{design:timer.design,active:timer.status==='running'&&timer.mode==='focus'&&!reducedMotion.matches});miniRender=signature;
  }
  async function openMini() {
    if(miniWindow&&!miniWindow.closed){miniWindow.focus();return;}if(miniOpening)return;miniOpening=true;
    try{
      const floating='documentPictureInPicture' in window;
      miniWindow=floating?await window.documentPictureInPicture.requestWindow({width:340,height:480}):window.open('about:blank','soft-stitch-mini','popup,width=340,height=500');
      if(!miniWindow){message('Allow pop-up windows for Soft Stitch to open the mini timer.');return;}
      const opened=miniWindow,doc=opened.document;doc.title='Soft Stitch - mini timer';
      for(const href of ['style.css','extras.css']){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL(href,location.href).href;doc.head.append(link);}
      doc.body.className='mini-page';const content=$('#compact-template').content.cloneNode(true);
      const closeIcon=$('#close-settings svg');if(closeIcon)content.querySelector('.mini-close').replaceChildren(closeIcon.cloneNode(true));
      doc.body.replaceChildren(content);miniCanvas=doc.querySelector('.mini-hoop');miniRender='';
      doc.querySelector('.mini-start').addEventListener('click',startPause);
      doc.querySelector('.mini-sound').addEventListener('click',()=>$('#sound-toggle').click());
      doc.querySelector('.mini-close').addEventListener('click',()=>opened.close());doc.querySelector('.mini-break').addEventListener('click',startBreak);
      opened.addEventListener('pagehide',()=>{if(miniWindow===opened){miniWindow=null;miniCanvas=null;miniRender='';}},{once:true});
      syncMini();tick();
      if(!floating)message('Mini timer opened in a regular window. Keep the studio open; this browser does not support always-on-top mode.');
    }catch{message('The mini timer could not open here. Try the live site in desktop Chrome or Edge.');}finally{miniOpening=false;}
  }

  D.birthFlowers.forEach((flower,i)=>{const option=document.createElement('option');option.value=i+1;option.textContent=new Date(2026,i,1).toLocaleDateString(undefined,{month:'long'})+' / '+flower;$('#birth-month').append(option);});
  document.querySelectorAll('[data-pattern]').forEach(button=>button.addEventListener('click',()=>{timer=newFocus({pattern:button.dataset.pattern});previewStart=null;$('#initials-error').hidden=true;save();updateControls();tick();}));
  document.querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',()=>{timer=newFocus({palette:button.dataset.palette});previewStart=null;save();updateControls();tick();}));
  document.querySelectorAll('[data-duration]').forEach(button=>button.addEventListener('click',()=>setDuration(button.dataset.duration)));
  $('#minutes').addEventListener('change',event=>setDuration(event.target.value));$('#intention').addEventListener('input',event=>{timer.intention=event.target.value;save();});
  $('#initials').addEventListener('change',()=>{if(validateInitials())updateDesign({initials:$('#initials').value.trim()});});
  $('#birth-month').addEventListener('change',event=>updateDesign({month:Number(event.target.value)}));
  colourInputs.forEach(selector=>$(selector).addEventListener('change',()=>updateDesign({colours:colourInputs.map(s=>$(s).value)})));
  $('#start-button').addEventListener('click',startPause);
  $('#reset-button').addEventListener('click',()=>{if(timer.status==='completed'||confirm(timer.mode==='break'?'Finish this break early?':'Start this piece over? The stitches in this session will be cleared.'))resetTimer();});
  $('#preview-button').addEventListener('click',()=>{if(!validateInitials())return;previewStart=performance.now();lastRendered='';});
  $('#sound-toggle').addEventListener('click',()=>{sound=!sound;unlockAudio();save();updateControls();tick();if(sound)chime();});
  $('#close-finish').addEventListener('click',()=>$('#finish-dialog').close());$('#download-finished').addEventListener('click',()=>{if(selectedPiece)download(selectedPiece);});
  $('#view-collection').addEventListener('click',()=>{$('#finish-dialog').close();location.hash='collection';});
  $('#finish-break').addEventListener('click',startBreak);$('#take-break').addEventListener('click',startBreak);
  $('#settings-toggle').addEventListener('click',()=>{updateControls();$('#settings-dialog').showModal();});$('#close-settings').addEventListener('click',()=>$('#settings-dialog').close());
  $('#break-length').addEventListener('change',event=>{preferences.breakMinutes=Number(event.target.value);save();updateControls();});
  $('#notifications').addEventListener('change',async event=>{
    if(!event.target.checked){preferences.notifications=false;save();return;}
    event.target.disabled=true;
    try{preferences.notifications=await Notification.requestPermission()==='granted';}catch{preferences.notifications=false;message('Your browser could not enable notifications.');}save();updateControls();
  });
  $('#compact-toggle').addEventListener('click',openMini);
  $('#export-backup').addEventListener('click',()=>{pieces=latestPieces();saveBlob(new Blob([JSON.stringify(D.backup(pieces),null,2)],{type:'application/json'}),'soft-stitch-collection-'+D.dayKey(Date.now())+'.json');});
  $('#import-backup').addEventListener('click',()=>$('#backup-file').click());
  $('#backup-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>8*1024*1024)throw new Error('Choose a backup smaller than 8 MB.');
      const incoming=D.parseBackup(await file.text()),before=latestPieces(),added=D.merge(before,incoming).length-before.length;
      if(save({add:incoming,requireStorage:true})){renderCollection();message(added?added+(added===1?' piece added.':' pieces added.')+' Your existing collection is unchanged.':'These pieces are already in your collection.');}
    }catch(error){message(error.message);}finally{event.target.value='';}
  });
  document.querySelectorAll('[data-collection-view]').forEach(button=>button.addEventListener('click',()=>{collectionView=button.dataset.collectionView;visiblePieces=24;renderCollection();}));
  function moveMonth(offset){calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+offset,1,12);selectedDay=null;visiblePieces=24;renderCollection();}
  $('#previous-month').addEventListener('click',()=>moveMonth(-1));$('#next-month').addEventListener('click',()=>moveMonth(1));
  $('#current-month').addEventListener('click',()=>{const now=new Date();calendarMonth=new Date(now.getFullYear(),now.getMonth(),1,12);selectedDay=D.dayKey(now);visiblePieces=24;renderCollection();});
  $('#show-month').addEventListener('click',()=>{selectedDay=null;visiblePieces=24;renderCollection();});$('#load-more').addEventListener('click',()=>{visiblePieces+=24;renderCollection();});
  window.addEventListener('hashchange',navigate);window.addEventListener('pagehide',()=>{if(miniWindow&&!miniWindow.closed)miniWindow.close();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();updateTotals();lastRendered='';unlockAudio();}});
  window.addEventListener('storage',event=>{
    if(event.key!==key||!event.newValue)return;
    try{const state=JSON.parse(event.newValue);if(!state||typeof state!=='object')return;timer=T.restore(state.timer);sound=state.sound===true;preferences=D.preferences(state.preferences);pieces=D.readPieces(state.pieces);previewStart=null;if(timer.status!=='completed'&&$('#finish-dialog').open)$('#finish-dialog').close();updateControls();tick();if(!$('#collection').hidden)renderCollection();}catch{ /* Ignore corrupt writes from another tab. */ }
  });
  updateControls();navigate();tick();requestAnimationFrame(frame);setInterval(()=>tick(),400);
  if(!storageAvailable)message('Browser storage is unavailable. Keep this tab open and export your collection before leaving.');
})();
