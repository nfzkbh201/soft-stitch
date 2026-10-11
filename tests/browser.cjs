const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const url = 'file://' + path.resolve('dist/index.html');
const key = 'soft-stitch:v1';

(async () => {
  fs.mkdirSync('.qa', { recursive:true });
  const browser = await chromium.launch({ executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport:{width:1440,height:1000} });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url);
    await page.waitForFunction(() => window.StitchData && document.querySelector('#hoop').getAttribute('aria-label').includes('percent'));
    await page.screenshot({path:'.qa/v2-studio.png',fullPage:true});
    assert.equal(await page.locator('[data-pattern]').count(),6);
    const needleProof=await page.evaluate(()=>{
      const design=Embroidery.pattern('cherries','rose'),total=design.stitches.length,index=design.stitches.findIndex(s=>s.colour===Embroidery.palettes.rose.main)+35,stitch=design.stitches[index];
      const canvas=document.createElement('canvas');canvas.width=700;canvas.height=700;
      Embroidery.draw(canvas,'cherries','rose',(index+.03)/total,{active:true,duration:total*2000});
      const below=canvas.toDataURL();Embroidery.draw(canvas,'cherries','rose',(index+.03)/total);
      const underClothMatches=below===canvas.toDataURL();
      const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=540;const ctx=sheet.getContext('2d');
      ctx.fillStyle='#faf5f5';ctx.fillRect(0,0,sheet.width,sheet.height);
      const phases=[.03,.14,.25,.4,.57,.64,.72,.81,.89,.98];
      phases.forEach((phase,i)=>{
        Embroidery.draw(canvas,'cherries','rose',(index+phase)/total,{active:true,duration:total*2000});
        const x=(i%5)*240,y=Math.floor(i/5)*270;
        ctx.drawImage(canvas,stitch.a.x+50-90,stitch.a.y+50-100,180,180,x+10,y+10,220,220);
        ctx.fillStyle='#71374a';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText(Embroidery.needlePose(stitch,phase).stage+' / '+phase,x+120,y+252);
      });
      return {underClothMatches,image:sheet.toDataURL('image/png').split(',')[1]};
    });
    assert.equal(needleProof.underClothMatches,true,'hidden needle must not paint over the cloth');
    fs.writeFileSync('.qa/needle-phases.png',Buffer.from(needleProof.image,'base64'));
    for(const id of ['cherries','bow','flowers','strawberries','initials','birthflower']){
      await page.locator('[data-pattern="'+id+'"]').click();
      if(id==='initials'){await page.locator('#initials').fill('NZK');await page.locator('#initials').press('Tab');}
      await page.waitForTimeout(150);
      await page.locator('.embroidery-stage').screenshot({path:'.qa/v2-'+id+'.png'});
    }
    const flowers = await page.evaluate(() => Array.from({length:12},(_,i)=>{
      const design = Embroidery.pattern('birthflower','rose',{month:i+1});
      return {name:StitchData.birthFlowers[i],length:design.stitches.length,valid:design.stitches.every(s=>[s.a.x,s.a.y,s.b.x,s.b.y,s.width].every(Number.isFinite))};
    }));
    assert.ok(flowers.every(f=>f.valid&&f.length>100));
    assert.ok(new Set(flowers.map(f=>f.length)).size>9);
    await page.locator('#birth-month').selectOption('6');
    await page.waitForTimeout(150);await page.locator('.embroidery-stage').screenshot({path:'.qa/v2-rose.png'});
    await page.locator('[data-palette="custom"]').click();
    await page.locator('#colour-main').fill('#aa3466');await page.locator('#colour-main').dispatchEvent('change');
    await page.locator('#preview-button').click();await page.waitForTimeout(2200);
    const before=await page.locator('#hoop').screenshot();await page.waitForTimeout(600);
    const after=await page.locator('#hoop').screenshot();assert.notDeepEqual(before,after);
    const pixels=PNG.sync.read(after).data;let coloured=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]-pixels[i+1]>25&&pixels[i+3]>0)coloured++;
    assert.ok(coloured>100,'embroidery canvas must be nonblank');
    await page.locator('[data-pattern="initials"]').click();
    await page.locator('#initials').fill('123');await page.locator('#start-button').click();
    assert.equal(await page.locator('#initials-error').isVisible(),true);
    await page.locator('#initials').fill('NZK');await page.locator('#initials').press('Tab');
    await page.locator('#minutes').fill('0');await page.locator('#start-button').click();
    assert.equal(await page.locator('#duration-error').isVisible(),true);
    await page.locator('#minutes').fill('1');await page.locator('#intention').fill('A chapter, all to myself');
    await page.locator('#start-button').click();await page.waitForTimeout(1250);
    assert.equal(await page.locator('#initials').isDisabled(),true);
    await page.locator('#start-button').click();
    const paused=await page.locator('#timer-display').innerText();await page.waitForTimeout(1100);
    assert.equal(await page.locator('#timer-display').innerText(),paused);
    await page.reload();assert.equal(await page.locator('#timer-display').innerText(),paused);
    assert.equal(await page.locator('#initials').inputValue(),'NZK');
    assert.equal(await page.locator('#colour-main').inputValue(),'#aa3466');
    await page.locator('#start-button').click();
    await page.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.timer.deadline=Date.now()-100;localStorage.setItem(key,JSON.stringify(saved));},key);
    await page.reload();await page.waitForSelector('#finish-dialog[open]');
    assert.equal(await page.locator('#collection-count').innerText(),'1');
    const downloadEvent=page.waitForEvent('download');await page.locator('#download-finished').click();
    const download=await downloadEvent;await download.saveAs('.qa/v2-keepsake.png');
    const exported=PNG.sync.read(fs.readFileSync('.qa/v2-keepsake.png'));assert.equal(exported.width,1200);assert.equal(exported.height,1400);
    await page.locator('#finish-break').click();assert.equal(await page.locator('#session-badge').innerText(),'BREAK');
    assert.equal(await page.locator('#timer-display').innerText(),'05:00');
    await page.locator('#start-button').click();await page.reload();
    assert.equal(await page.locator('#start-button').innerText(),'Continue break');await page.locator('#start-button').click();
    await page.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.timer.deadline=Date.now()-100;localStorage.setItem(key,JSON.stringify(saved));},key);
    await page.reload();await page.waitForFunction(()=>document.querySelector('#start-button').textContent==='Back to stitching');
    assert.equal(await page.locator('#collection-count').innerText(),'1');assert.equal(await page.locator('#finish-dialog').isVisible(),false);
    await page.locator('#start-button').click();assert.equal(await page.locator('#timer-display').innerText(),'01:00');
    await page.locator('#settings-toggle').click();await page.locator('#break-length').selectOption('0');
    await page.locator('#close-settings').click();await page.reload();
    assert.equal(await page.locator('#break-length').inputValue(),'0');

    await page.locator('[data-view="collection"]').click();
    const fixtures=await page.evaluate(()=>{
      const now=new Date();return Array.from({length:9},(_,i)=>({id:'fixture-'+i,pattern:StitchData.patterns[i%6],palette:['rose','blue','peach'][i%3],minutes:[15,25,45][i%3],completedAt:new Date(now.getFullYear(),now.getMonth(),[1,3,4,7,7,10,14,17,20][i],12).getTime(),design:{initials:'NZK',month:i%12+1},intention:i===0?'<img src=x onerror=alert(1)>':'Browser QA sample'}));
    });
    const backup=JSON.stringify({app:'soft-stitch',version:2,pieces:fixtures});
    await page.locator('#backup-file').setInputFiles({name:'collection.json',mimeType:'application/json',buffer:Buffer.from(backup)});
    await page.waitForFunction(()=>document.querySelector('#collection-count').textContent==='10');
    await page.locator('#backup-file').setInputFiles({name:'collection.json',mimeType:'application/json',buffer:Buffer.from(backup)});
    await page.waitForTimeout(100);assert.equal(await page.locator('#collection-count').innerText(),'10');
    assert.equal(await page.locator('.piece-card img').count(),0,'imported text must not become HTML');
    await page.locator('#backup-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"app":"soft-stitch","version":2,"pieces":[{}]}')});
    await page.waitForTimeout(100);assert.equal(await page.locator('#collection-count').innerText(),'10');
    assert.match(await page.locator('#toast').innerText(),/Nothing was imported/);
    const backupEvent=page.waitForEvent('download');await page.locator('#export-backup').click();
    const backupDownload=await backupEvent;await backupDownload.saveAs('.qa/v2-backup.json');
    assert.equal(JSON.parse(fs.readFileSync('.qa/v2-backup.json','utf8')).pieces.length,10);
    await page.waitForFunction(()=>document.querySelector('#toast').hidden);
    await page.locator('[data-collection-view="calendar"]').click();
    await page.screenshot({path:'.qa/v2-calendar.png',fullPage:true});
    const day7=page.locator('.calendar-day:not(.outside)').filter({has:page.locator('.day-number',{hasText:/^7$/})});
    await day7.click();assert.equal(await page.locator('.piece-card').count(),2);
    await page.locator('#previous-month').click();assert.equal(await page.locator('.calendar-day.has-piece').count(),0);
    await page.locator('#next-month').click();assert.ok(await page.locator('.calendar-day.has-piece').count()>0);
    for(const width of [375,390,580,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      for(const hash of ['collection','studio']){
        await page.evaluate(hash=>{location.hash=hash;},hash);await page.waitForTimeout(150);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no overflow at '+width+' in '+hash);
        if([390,768,1440].includes(width))await page.screenshot({path:'.qa/v2-'+hash+'-'+width+'.png',fullPage:true});
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.timer=StitchTimer.pause(StitchTimer.start(saved.timer,Date.now()-30000,'mini-test'));localStorage.setItem(key,JSON.stringify(saved));},key);
    await page.reload();
    // Exercise the actual browser PiP API, not a simulated widget.
    const pipSupported=await page.evaluate(()=>!!window.documentPictureInPicture);
    await page.locator('#compact-toggle').click();
    await page.waitForFunction(()=>window.documentPictureInPicture?.window?.document.querySelector('.mini-time')||document.querySelector('#toast').textContent.includes('could not open'));
    if(pipSupported){
      assert.equal(await page.evaluate(()=>!!documentPictureInPicture.window),true,'native mini window must open');
      await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('.mini-start').click());
      assert.match(await page.locator('#start-button').innerText(),/Pause stitching/);
      const miniPage=context.pages().find(p=>p!==page);
      if(miniPage){
        await miniPage.setViewportSize({width:340,height:480});await miniPage.bringToFront();
        const before=await miniPage.locator('.mini-hoop').screenshot();await miniPage.waitForTimeout(750);
        assert.notDeepEqual(before,await miniPage.locator('.mini-hoop').screenshot(),'mini needle must animate independently');
      }
      await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('.mini-start').click());
      assert.match(await page.locator('#start-button').innerText(),/Keep stitching/);
      if(miniPage){
        await miniPage.waitForTimeout(120);const frozen=await miniPage.locator('.mini-hoop').screenshot();await miniPage.waitForTimeout(300);
        assert.deepEqual(frozen,await miniPage.locator('.mini-hoop').screenshot(),'pause must freeze the needle');
        await miniPage.screenshot({path:'.qa/v2-mini.png',fullPage:true});assert.equal(await miniPage.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true,'mini timer fits its window');
      }
      await page.evaluate(()=>documentPictureInPicture.window.close());
    }
    await page.locator('#reset-button').click();
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#preview-button').click();await page.waitForTimeout(500);
    assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    assert.deepEqual(errors,[]);
    const fallbackContext=await browser.newContext({viewport:{width:390,height:844}});
    await fallbackContext.addInitScript(()=>{delete window.documentPictureInPicture;});
    const fallback=await fallbackContext.newPage();fallback.on('pageerror',error=>errors.push(error.message));
    await fallback.goto(url);
    const popupEvent=fallback.waitForEvent('popup');await fallback.locator('#compact-toggle').click();const popup=await popupEvent;
    await popup.waitForSelector('.mini-time');await popup.setViewportSize({width:300,height:440});
    assert.equal(await popup.locator('.mini-time').innerText(),'25:00');
    await popup.locator('.mini-start').click();assert.match(await fallback.locator('#start-button').innerText(),/Pause stitching/);
    await popup.locator('.mini-start').click();assert.match(await fallback.locator('#start-button').innerText(),/Keep stitching/);
    assert.match(await fallback.locator('#toast').innerText(),/regular window/);
    await popup.locator('.mini-close').click();await fallbackContext.close();
    const notificationContext=await browser.newContext();
    await notificationContext.addInitScript(()=>{
      window.noticeLog=[];window.permissionRequests=0;
      window.Notification=class {static permission=sessionStorage.getItem('notice-permission')||'default';static async requestPermission(){window.permissionRequests++;this.permission='granted';sessionStorage.setItem('notice-permission','granted');return 'granted';}constructor(title,options){window.noticeLog.push({title,options});}close(){}};
    });
    const noticePage=await notificationContext.newPage();noticePage.on('pageerror',error=>errors.push(error.message));await noticePage.goto(url);
    assert.equal(await noticePage.evaluate(()=>permissionRequests),0,'no unsolicited permission prompt');
    await noticePage.locator('#settings-toggle').click();await noticePage.locator('#notifications').check();
    assert.equal(await noticePage.evaluate(()=>permissionRequests),1);await noticePage.locator('#close-settings').click();
    await noticePage.locator('#start-button').click();
    await noticePage.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.timer.deadline=Date.now()-1;localStorage.setItem(key,JSON.stringify(saved));},key);await noticePage.reload();
    await noticePage.waitForSelector('#finish-dialog[open]');
    assert.equal(await noticePage.evaluate(()=>JSON.parse(localStorage.getItem('soft-stitch:v1')).preferences.notifications),true);
    assert.equal(await noticePage.evaluate(()=>noticeLog.length),1);
    await noticePage.reload();assert.equal(await noticePage.evaluate(()=>noticeLog.length),0,'completed sessions do not notify twice');
    await notificationContext.close();assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,patterns:6,needleOcclusion:needleProof.underClothMatches,birthFlowers:flowers.map(f=>f.name),viewports:[375,390,580,768,1024,1440],nativePictureInPicture:pipSupported,errors},null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
