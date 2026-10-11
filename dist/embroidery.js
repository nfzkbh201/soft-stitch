(function (root) {
  'use strict';
  const palettes = {
    rose: { main: '#ae3959', light: '#da7991', dark: '#792b48', green: '#667c4e', pale: '#a6b379', yellow: '#d2ac59' },
    blue: { main: '#527c9c', light: '#8fbdc9', dark: '#355970', green: '#658275', pale: '#a1b6a0', yellow: '#d4ae65' },
    peach: { main: '#cc735b', light: '#edaa91', dark: '#9b4e43', green: '#708357', pale: '#b2bd88', yellow: '#d9b75c' }
  };
  const names = { cherries: 'Cherry picking', bow: 'Tied with love', flowers: 'In full bloom', strawberries: 'Berry sweet', initials: 'Yours, truly', birthflower: 'Born to bloom' };
  const cache = new Map();
  let fabric;
  const point = (x, y) => ({ x, y });
  function curve(a, b, c, d, count = 35) {
    const points = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count, u = 1 - t;
      points.push(point(u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0], u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]));
    }
    return points;
  }
  function mix(hex, target, amount) {
    const channels = [1,3,5].map(i => Math.round(parseInt(hex.slice(i,i+2),16)*(1-amount)+target*amount));
    return '#' + channels.map(c => c.toString(16).padStart(2,'0')).join('');
  }
  function coloursFor(paletteName, config) {
    if (paletteName !== 'custom') return palettes[paletteName] || palettes.rose;
    const [main,yellow,green] = root.StitchData.design(config).colours;
    return { main, light:mix(main,255,.38), dark:mix(main,0,.27), green, pale:mix(green,255,.36), yellow };
  }
  function title(id, config) {
    const value = root.StitchData.design(config);
    return id === 'initials' ? value.initials + ', yours truly' : id === 'birthflower' ? root.StitchData.birthFlowers[value.month-1] : names[id];
  }
  function pattern(id, paletteName, config) {
    config = root.StitchData.design(config);
    const key = id + paletteName + JSON.stringify(config);
    if (cache.has(key)) return cache.get(key);
    const colours = coloursFor(paletteName,config), stitches = [], outlines = [];
    function run(points, colour, width = 3.5) {
      outlines.push(points);
      for (let i = 1; i < points.length; i++) stitches.push({ a: points[i - 1], b: points[i], colour, width });
    }
    function satin(points, colour, gap = 2.6, angle = .6) {
      outlines.push([...points, points[0]]);
      const cos=Math.cos(angle), sin=Math.sin(angle);
      points=points.map(p=>point(p.x*cos+p.y*sin,-p.x*sin+p.y*cos));
      const unrotate=(x,y)=>point(x*cos-y*sin,x*sin+y*cos);
      const ys = points.map(p => p.y), min = Math.min(...ys), max = Math.max(...ys);
      for (let y = min + 1; y < max; y += gap) {
        const intersections = [];
        for (let i = 0; i < points.length; i++) {
          const p = points[i], q = points[(i + 1) % points.length];
          if ((p.y <= y && q.y > y) || (q.y <= y && p.y > y)) intersections.push(p.x + (y - p.y) / (q.y - p.y) * (q.x - p.x));
        }
        intersections.sort((a,b) => a-b);
        for (let i = 0; i + 1 < intersections.length; i += 2) {
          const start = intersections[i], end = intersections[i+1];
          // Directional long-and-short stitches stagger their joins like real floss.
          for (let x = start; x < end;) {
            const length=18+11*(.5+.5*Math.sin(y*1.72+x*.16)), next=Math.min(x+length,end);
            const wobble=Math.sin(x*.7+y*1.9)*.25;
            stitches.push({ a: unrotate(x,y+wobble), b: unrotate(next,y+.28+wobble), colour, width: 2.35 });
            x=next+.2;
          }
        }
      }
    }
    function ellipse(cx,cy,rx,ry,angle,colour) {
      const points = [];
      for (let i=0;i<64;i++) { const t=i*Math.PI/32,x=rx*Math.cos(t),y=ry*Math.sin(t); points.push(point(cx+x*Math.cos(angle)-y*Math.sin(angle),cy+x*Math.sin(angle)+y*Math.cos(angle))); }
      satin(points,colour,2.6,angle+.9);
    }
    function leaf(a,b,c,d,colour) {
      const points=curve(a,b,c,d,24).concat(curve(d,[c[0]-24,c[1]+35],[b[0]-12,b[1]+32],a,24));
      satin(points,colour,2.6,Math.atan2(d[1]-a[1],d[0]-a[0])+.7);run(curve(a,[(a[0]+d[0])/2,a[1]],[(a[0]+d[0])/2,d[1]],d,18),colours.green,1.9);
    }
    function petals(cx,cy,r,count,colour,narrow=.3,rotation=0) {
      for(let i=0;i<count;i++){const a=i*Math.PI*2/count+rotation;ellipse(cx+Math.cos(a)*r*.62,cy+Math.sin(a)*r*.62,r*.56,r*narrow,a,colour);}
    }
    function rosette(cx,cy,r,count,layers,colour) {
      for(let layer=0;layer<layers;layer++) petals(cx,cy,r*(1-layer*.2),count,layer%2?colours.light:colour,.3,layer*.32);
      ellipse(cx,cy,r*.14,r*.14,0,colours.yellow);
    }
    if (id === 'cherries') {
      run(curve([288,201],[287,263],[246,298],[236,328]),colours.green,5);
      run(curve([288,201],[322,230],[355,286],[359,349]),colours.green,5);
      leaf([292,222],[316,161],[376,167],[390,176],colours.green);
      leaf([286,216],[258,178],[226,184],[202,198],colours.pale);
      ellipse(233,358,56,59,-.12,colours.main);
      ellipse(359,377,57,60,.18,colours.main);
      run(curve([199,352],[194,331],[206,320],[218,319],17),colours.light,5);
      run(curve([325,370],[324,348],[333,341],[344,339],17),colours.light,5);
      run(curve([227,329],[230,324],[239,324],[245,327],12),colours.dark,3);
      run(curve([350,347],[355,343],[363,345],[369,349],12),colours.dark,3);
      run(curve([263,390],[251,409],[226,415],[213,406],18),colours.dark,2.4);
      run(curve([390,414],[378,431],[352,435],[339,426],18),colours.dark,2.4);
    } else if (id === 'bow') {
      const left=curve([296,287],[197,173],[136,232],[168,295]).concat(curve([168,295],[195,345],[258,297],[296,287]));
      const right=curve([302,285],[369,170],[448,218],[425,281]).concat(curve([425,281],[417,335],[337,305],[302,285]));
      satin(curve([284,292],[289,352],[244,369],[231,421]).concat([point(203,397),point(175,399)]).concat(curve([175,399],[199,338],[254,325],[284,292])),colours.main);
      satin(curve([307,293],[339,324],[351,363],[388,393]).concat([point(361,395),point(349,422)]).concat(curve([349,422],[306,386],[306,337],[307,293])),colours.main);
      satin(left,colours.light,2.6,-.55);satin(right,colours.light,2.6,.55);
      run(curve([190,249],[208,236],[259,270],[285,285]),colours.main,4);
      run(curve([413,245],[385,244],[349,267],[316,284]),colours.main,4);
      run(curve([270,325],[245,351],[214,367],[201,389]),colours.light,4);
      run(curve([321,329],[330,355],[339,378],[357,397]),colours.light,4);
      ellipse(299,288,21,24,.12,colours.main);
      run(curve([293,269],[286,280],[289,296],[296,305],14),colours.light,3);
    } else if (id === 'strawberries') {
      const berry=(cx,cy,scale,tilt)=>{
        const transform=p=>point(cx+(p.x*Math.cos(tilt)-p.y*Math.sin(tilt))*scale,cy+(p.x*Math.sin(tilt)+p.y*Math.cos(tilt))*scale);
        const shape=curve([0,-48],[-88,-76],[-81,15],[0,90]).concat(curve([0,90],[81,15],[88,-76],[0,-48]));
        satin(shape.map(transform),colours.main,2.6,tilt+.9);
        for(let y=-28;y<62;y+=20)for(let x=-42;x<=42;x+=21){if(Math.abs(x)>50-(y+28)*.45)continue;const a=transform(point(x+(y%40?3:-3),y));run([a,point(a.x-2,a.y+5)],colours.yellow,2.7);}
        for(let i=0;i<5;i++){const a=-Math.PI+i*Math.PI/4;const p=transform(point(Math.cos(a)*35,-47+Math.sin(a)*18));const center=transform(point(0,-45));ellipse((center.x+p.x)/2,(center.y+p.y)/2,24*scale,8*scale,Math.atan2(p.y-center.y,p.x-center.x),i%2?colours.pale:colours.green);}
      };
      run(curve([258,254],[256,209],[307,200],[335,243]),colours.green,4);
      leaf([278,232],[279,194],[309,180],[338,190],colours.green);
      berry(251,315,1,-.22);berry(365,365,.72,.28);
      petals(384,235,27,5,colours.light,.3);ellipse(384,235,7,7,0,colours.yellow);
    } else if (id === 'initials') {
      run(curve([271,442],[154,402],[152,244],[230,205]),colours.green,3);
      run(curve([329,442],[446,402],[448,244],[370,205]),colours.green,3);
      for(let i=0;i<7;i++){
        const a=2.1+i*.26,x=300+124*Math.cos(a),y=312+139*Math.sin(a);
        ellipse(x,y,20,7,a+.6,i%2?colours.pale:colours.green);
        ellipse(600-x,y,20,7,-a-.6,i%2?colours.pale:colours.green);
      }
      const mask=document.createElement('canvas');mask.width=600;mask.height=600;
      const c=mask.getContext('2d');c.textAlign='center';c.textBaseline='middle';c.font='italic bold '+(config.initials.length===3?82:config.initials.length===2?110:165)+'px Georgia';c.fillText(config.initials,300,322,204);
      const pixels=c.getImageData(0,0,600,600).data;
      for(let y=205;y<411;y+=2.6)for(let x=172;x<430;){
        if(pixels[(Math.floor(y)*600+Math.floor(x))*4+3]<100){x++;continue;}
        const start=x;while(x<430&&x-start<16&&pixels[(Math.floor(y)*600+Math.floor(x))*4+3]>=100)x++;
        stitches.push({a:point(start,y),b:point(x,y+.2),colour:colours.main,width:2.4});
      }
      petals(300,431,17,5,colours.light,.3);ellipse(300,431,4,4,0,colours.yellow);
    } else if (id === 'birthflower') {
      const month=config.month;
      run(curve([298,450],[325,364],[268,289],[305,226]),colours.green,4);
      leaf([302,391],[251,350],[228,350],[212,365],colours.green);
      leaf([299,341],[342,299],[379,313],[386,330],colours.pale);
      if(month===5){
        for(let i=0;i<5;i++){
          const x=299+(i%2?-23:21),y=230+i*27;
          run(curve([291+i*2,y-20],[x,y-33],[x+10,y-18],[x,y]),colours.green,2.8);
          satin(curve([x-13,y],[x-15,y+15],[x-25,y+20],[x-18,y+25]).concat(curve([x-18,y+25],[x,y+16],[x+21,y+32],[x+16,y+18]),curve([x+16,y+18],[x+12,y+8],[x+12,y],[x-13,y])),colours.light,2.6,1.5);
        }
      } else if(month===6){
        for(let layer=0;layer<4;layer++){
          const radius=65-layer*14;
          for(let petal=0;petal<5;petal++){
            const angle=petal*Math.PI*2/5+layer*.57,points=[];
            for(let j=0;j<=20;j++){const t=j/20,a=angle-.69+t*1.45,r=radius*(.87+.13*Math.sin(t*Math.PI));points.push(point(302+Math.cos(a)*r,238+Math.sin(a)*r));}
            for(let j=20;j>=0;j--){const t=j/20,a=angle-.69+t*1.45,r=radius*.5;points.push(point(302+Math.cos(a)*r,238+Math.sin(a)*r));}
            satin(points,(petal+layer)%2?colours.light:colours.main,2.4,angle+Math.PI/2);
          }
        }
        const spiral=[];for(let i=0;i<50;i++){const a=i*.17,r=2+i*.15;spiral.push(point(302+Math.cos(a)*r,238+Math.sin(a)*r));}run(spiral,colours.dark,2.6);
      } else if(month===1||month===11){
        rosette(302,240,65,month===1?9:16,3,colours.main);
      } else if(month===7){
        for(let i=0;i<3;i++)petals(302,244,68-i*15,8,colours.light,.18,i*.39);
        ellipse(302,244,13,13,0,colours.yellow);
      } else if(month===12){
        [[265,244],[340,242],[300,183]].forEach(([x,y])=>{run(curve([298,326],[299,284],[x,y+60],[x,y]),colours.green,3);petals(x,y,32,6,colours.light,.23);ellipse(x,y,8,8,0,colours.yellow);});
      } else {
        const count={2:5,3:6,4:12,8:4,9:18,10:8}[month];
        const narrow=month===8?.54:month===2?.43:month===9?.13:.23;
        petals(302,242,65,count,colours.main,narrow,-Math.PI/2);
        if(month===3){petals(302,242,25,6,colours.yellow,.3);ellipse(302,242,10,10,0,colours.dark);}
        else ellipse(302,242,month===8?18:14,month===8?18:14,0,month===8?colours.dark:colours.yellow);
        if(month===8)for(let i=0;i<12;i++){const a=i*Math.PI/6;run([point(302+Math.cos(a)*10,242+Math.sin(a)*10),point(302+Math.cos(a)*23,242+Math.sin(a)*23)],colours.yellow,2);}
      }
    } else {
      run(curve([298,426],[290,336],[259,293],[239,244]),colours.green,4);
      run(curve([299,424],[310,343],[342,303],[367,258]),colours.green,4);
      run(curve([299,425],[322,353],[315,271],[307,214]),colours.green,4);
      leaf([292,371],[253,322],[225,330],[213,337],colours.pale);
      leaf([309,342],[353,318],[385,341],[387,350],colours.green);
      leaf([283,326],[250,286],[220,294],[211,300],colours.green);
      const flower=(cx,cy,r,c)=>{for(let i=0;i<8;i++){const a=i*Math.PI/4;ellipse(cx+Math.cos(a)*r*.75,cy+Math.sin(a)*r*.75,r*.62,r*.28,a,c);}ellipse(cx,cy,r*.29,r*.29,0,colours.yellow);};
      flower(238,238,43,colours.light);flower(310,201,47,colours.main);flower(373,252,38,colours.light);
      run(curve([286,411],[272,396],[256,411],[297,415]).concat(curve([297,415],[330,390],[337,415],[301,417])),colours.main,3.2);
      run(curve([297,417],[283,434],[280,438],[279,448]),colours.main,3);
      run(curve([299,418],[310,433],[319,435],[323,441]),colours.main,3);
    }
    const result={stitches,outlines};if(cache.size>=160)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
  }
  function fabricPattern(ctx) {
    if (!fabric) {
      fabric=document.createElement('canvas');fabric.width=128;fabric.height=128;
      const f=fabric.getContext('2d');f.fillStyle='#faf5ea';f.fillRect(0,0,128,128);
      for(let y=0;y<128;y+=3){f.fillStyle=y%2?'#dbd2bf32':'#ffffff99';f.fillRect(0,y,128,1);}
      for(let x=0;x<128;x+=3){f.fillStyle=x%2?'#c9bda12d':'#ffffff88';f.fillRect(x,0,1,128);}
      for(let x=0;x<128;x+=6)for(let y=0;y<128;y+=6){f.fillStyle='#a9977930';f.fillRect(x+(y%12?0:3),y,1,1);}
    }
    return ctx.createPattern(fabric,'repeat');
  }
  function drawThread(ctx,s,alpha=1) {
    ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineWidth=s.width;ctx.strokeStyle=s.colour;
    ctx.beginPath();ctx.moveTo(s.a.x,s.a.y);ctx.lineTo(s.b.x,s.b.y);ctx.stroke();
    const length=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)||1,nx=(s.b.y-s.a.y)/length,ny=-(s.b.x-s.a.x)/length;
    ctx.strokeStyle='#fff';ctx.globalAlpha=alpha*.3;ctx.lineWidth=.65;
    ctx.beginPath();ctx.moveTo(s.a.x+nx*.65,s.a.y+ny*.65);ctx.lineTo(s.b.x+nx*.65,s.b.y+ny*.65);ctx.stroke();
    ctx.globalAlpha=alpha*.1;ctx.strokeStyle='#2e1d1d';ctx.lineWidth=.6;
    ctx.beginPath();ctx.moveTo(s.a.x-nx,s.a.y-ny);ctx.lineTo(s.b.x-nx,s.b.y-ny);ctx.stroke();ctx.globalAlpha=1;
  }
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const t=clamp(value); return t*t*(3-2*t); };
  const project = p => point(p.x, p.y-p.z*.72);
  function stitchFrame(total, progress, duration = total*2000) {
    const position=clamp(progress)*total;
    if(position>=total)return {done:total,index:total,phase:1};
    // Fast sessions are a time lapse, with one legible needle pass per batch.
    const batch=Math.max(1,Math.ceil(total*1400/Math.max(1,duration)));
    const start=Math.floor(position/batch)*batch,end=Math.min(total,start+batch),phase=(position-start)/(end-start);
    const done=start+Math.floor((end-start)*ease((phase-.84)/.12));
    return {done,index:end-1,phase};
  }
  function needlePose(stitch, phase) {
    const p=clamp(phase),a=stitch.a,b=stitch.b;
    let tip,axis,stage,hole=null,holeAmount=0;
    if(p<.06){stage='below';tip={x:a.x,y:a.y,z:-70};axis={x:24,y:8,z:-56};}
    else if(p<.3){
      stage='emerge';const rise=ease((p-.06)/.24)*1.25;
      axis={x:24,y:8,z:-56};tip={x:a.x-axis.x*rise,y:a.y-axis.y*rise,z:56*rise};
      hole=a;holeAmount=1-clamp((rise-1)/.25);
    }else if(p<.58){
      stage='travel';const t=ease((p-.3)/.28),angle=t*Math.PI;
      axis={x:24*Math.cos(angle)+36*Math.sin(angle),y:8*Math.cos(angle),z:-56*Math.cos(angle)};
      tip={x:(a.x-30)*(1-t)+b.x*t,y:(a.y-10)*(1-t)+b.y*t,z:70*(1-t)+24*Math.sin(t*Math.PI)};
    }else if(p<.84){
      stage='pierce';const depth=ease((p-.58)/.26)*1.14;
      axis={x:-24,y:-8,z:56};tip={x:b.x-axis.x*depth,y:b.y-axis.y*depth,z:-56*depth};
      hole=b;holeAmount=1;
    }else{
      stage='tighten';axis={x:-24,y:-8,z:56};tip={x:b.x+30,y:b.y+10,z:-70};
      hole=b;holeAmount=1-ease((p-.84)/.12);
    }
    const at=t=>({x:tip.x+axis.x*t,y:tip.y+axis.y*t,z:tip.z+axis.z*t});
    let from=0,to=1;
    // Intersect the needle with z=0. Only the metal above the cloth is rendered.
    if(axis.z>0)from=Math.max(0,-tip.z/axis.z);
    else if(axis.z<0)to=Math.min(1,-tip.z/axis.z);
    else if(tip.z<0)to=-1;
    const visible=from<to&&from<1&&to>0;
    const eye=at(.91),end=eye.z>0?project(eye):p<.3?a:b;
    const slack=p<.3?Math.max(0,eye.z)*1.5:p<.84?24+Math.max(0,eye.z)*.55:24*(1-ease((p-.84)/.12));
    return {stage,tip,axis,eye,end,slack,hole,holeAmount,visible,from:clamp(from),to:clamp(to),at};
  }
  function drawNeedle(ctx,stitch,phase) {
    const pose=needlePose(stitch,phase),{hole,holeAmount}=pose;
    if(hole&&holeAmount>0){
      ctx.save();ctx.globalAlpha=holeAmount;
      ctx.strokeStyle='#927e6040';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(hole.x,hole.y+1,5,2.4,0,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#66503b9c';ctx.beginPath();ctx.ellipse(hole.x,hole.y,2.25,1.15,-.2,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fffaf0';ctx.beginPath();ctx.ellipse(hole.x,hole.y+.8,2.6,1.5,0,0,Math.PI);ctx.stroke();ctx.restore();
    }
    if(pose.stage!=='below'&&(pose.eye.z>0||phase>=.3)){
      const {end,slack}=pose,dx=end.x-stitch.a.x,dy=end.y-stitch.a.y,length=Math.hypot(dx,dy)||1;
      const nx=-dy/length,ny=dx/length;
      ctx.save();ctx.lineCap='round';ctx.strokeStyle=stitch.colour;ctx.lineWidth=stitch.width*.82;
      ctx.shadowColor='#4d362c30';ctx.shadowBlur=2;ctx.shadowOffsetY=2;
      ctx.beginPath();ctx.moveTo(stitch.a.x,stitch.a.y);
      ctx.bezierCurveTo(stitch.a.x+dx*.23+nx*slack,stitch.a.y+dy*.23+ny*slack,end.x-dx*.2+nx*slack*.55,end.y-dy*.2+ny*slack*.55,end.x,end.y);ctx.stroke();
      ctx.shadowColor='transparent';ctx.strokeStyle='#ffffff50';ctx.lineWidth=.6;ctx.stroke();ctx.restore();
    }
    if(!pose.visible)return pose;
    const start=project(pose.at(pose.from)),end=project(pose.at(pose.to));
    const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
    const startWidth=pose.from<.08?pose.from*19:1.55,endWidth=1.65;
    ctx.save();
    const groundStart=pose.at(pose.from),groundEnd=pose.at(pose.to);
    ctx.strokeStyle='#49312628';ctx.lineWidth=3;ctx.shadowColor='#49312633';ctx.shadowBlur=5;
    ctx.beginPath();ctx.moveTo(groundStart.x+3,groundStart.y+3);ctx.lineTo(groundEnd.x+3,groundEnd.y+3);ctx.stroke();ctx.shadowColor='transparent';
    const metal=ctx.createLinearGradient(start.x-nx*2,start.y-ny*2,start.x+nx*2,start.y+ny*2);
    metal.addColorStop(0,'#656773');metal.addColorStop(.32,'#fafbff');metal.addColorStop(.66,'#b8bec9');metal.addColorStop(1,'#606471');ctx.fillStyle=metal;
    ctx.beginPath();ctx.moveTo(start.x-nx*startWidth,start.y-ny*startWidth);ctx.lineTo(end.x-nx*endWidth,end.y-ny*endWidth);ctx.lineTo(end.x+nx*endWidth,end.y+ny*endWidth);ctx.lineTo(start.x+nx*startWidth,start.y+ny*startWidth);ctx.closePath();ctx.fill();ctx.strokeStyle='#646270';ctx.lineWidth=.55;ctx.stroke();
    if(pose.from<.88&&pose.to>.94){
      const eye=project(pose.eye),angle=Math.atan2(dy,dx);
      ctx.strokeStyle='#53535e';ctx.lineWidth=.8;ctx.fillStyle='#6b6460';ctx.beginPath();ctx.ellipse(eye.x,eye.y,3.4,.85,angle,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle=stitch.colour;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(eye.x-nx*2,eye.y-ny*2);ctx.lineTo(eye.x+nx*.5,eye.y+ny*.5);ctx.stroke();
    }
    ctx.restore();return pose;
  }
  function draw(canvas, id='cherries', palette='rose', progress=1, options={}) {
    const ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
    ctx.clearRect(0,0,width,height);ctx.save();ctx.scale(width/700,height/700);
    const cx=350,cy=359,r=258;
    if(!options.thumbnail){
      ctx.save();ctx.shadowColor='#65412c25';ctx.shadowBlur=20;ctx.shadowOffsetY=12;ctx.fillStyle='#ad7c50';ctx.beginPath();ctx.arc(cx,cy,r+12,0,Math.PI*2);ctx.fill();ctx.restore();
      const wood=ctx.createLinearGradient(90,80,620,620);wood.addColorStop(0,'#e7cda3');wood.addColorStop(.25,'#c59763');wood.addColorStop(.45,'#f0d9b0');wood.addColorStop(.72,'#cda374');wood.addColorStop(1,'#b18457');
      ctx.lineWidth=17;ctx.strokeStyle=wood;ctx.beginPath();ctx.arc(cx,cy,r+4,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<5;i++){ctx.strokeStyle=i%2?'#ffeed33a':'#94734d45';ctx.lineWidth=.9;ctx.beginPath();ctx.arc(cx,cy,r+i*2-1,0,Math.PI*2);ctx.stroke();}
      ctx.fillStyle=fabricPattern(ctx);ctx.beginPath();ctx.arc(cx,cy,r-6,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,r-6,0,Math.PI*2);ctx.clip();const shading=ctx.createRadialGradient(320,320,150,cx,cy,r);shading.addColorStop(0,'#a48b6500');shading.addColorStop(.92,'#a48b6500');shading.addColorStop(1,'#61432d27');ctx.fillStyle=shading;ctx.fillRect(50,55,600,610);ctx.restore();
      ctx.strokeStyle='#9d8058';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(cx,cy,r-7,0,Math.PI*2);ctx.stroke();
      // The screw and tabs are part of the working hoop, with metallic highlights.
      ctx.fillStyle='#bca072';ctx.fillRect(325,75,13,30);ctx.fillRect(362,75,13,30);ctx.fillStyle='#e2c89b';ctx.fillRect(329,74,5,28);ctx.fillRect(366,74,5,28);
      ctx.fillStyle='#9d875c';ctx.fillRect(324,77,62,8);ctx.fillStyle='#e5d2a5';ctx.fillRect(324,77,62,2);
      for(let x=338;x<365;x+=3){ctx.fillStyle='#786947';ctx.fillRect(x,79,1,6);}
      ctx.fillStyle='#ad9262';ctx.fillRect(381,72,8,18);ctx.fillStyle='#d9c695';ctx.fillRect(382,72,2,18);
    }
    ctx.translate(50,50);
    if(options.thumbnail){ctx.translate(300,300);ctx.scale(1.65,1.65);ctx.translate(-300,-300);}
    const design=pattern(id,palette,options.design),position=design.stitches.length*clamp(progress);
    const sewing=options.active&&progress<1,frame=stitchFrame(design.stitches.length,progress,options.duration);
    const n=sewing?frame.done:Math.floor(position);
    if(progress<1&&!options.thumbnail){ctx.lineWidth=1;ctx.strokeStyle='#b398aa42';ctx.setLineDash([2,4]);for(const points of design.outlines){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}ctx.setLineDash([]);}
    for(let i=0;i<n;i++) drawThread(ctx,design.stitches[i]);
    if(sewing&&frame.index<design.stitches.length)drawNeedle(ctx,design.stitches[frame.index],frame.phase);
    if(!options.thumbnail){ctx.fillStyle='#b2a28f';ctx.textAlign='center';ctx.font='italic 15px Georgia';ctx.fillText(progress>=1?'a little time, a little thread':'one stitch at a time',300,491);}
    ctx.restore();return {done:n,total:design.stitches.length};
  }
  root.Embroidery={draw,pattern,palettes,names,coloursFor,title,needlePose,stitchFrame};
})(globalThis);
