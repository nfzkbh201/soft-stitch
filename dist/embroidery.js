(function (root) {
  'use strict';
  const palettes = {
    rose: { main: '#ae3959', light: '#da7991', dark: '#792b48', green: '#667c4e', pale: '#a6b379', yellow: '#d2ac59' },
    blue: { main: '#527c9c', light: '#8fbdc9', dark: '#355970', green: '#658275', pale: '#a1b6a0', yellow: '#d4ae65' },
    peach: { main: '#cc735b', light: '#edaa91', dark: '#9b4e43', green: '#708357', pale: '#b2bd88', yellow: '#d9b75c' }
  };
  const names = { cherries: 'Cherry picking', bow: 'Tied with love', flowers: 'In full bloom' };
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
  function pattern(id, paletteName) {
    const key = id + paletteName;
    if (cache.has(key)) return cache.get(key);
    const colours = palettes[paletteName], stitches = [], outlines = [];
    function run(points, colour, width = 3.5) {
      outlines.push(points);
      for (let i = 1; i < points.length; i++) stitches.push({ a: points[i - 1], b: points[i], colour, width });
    }
    function satin(points, colour, gap = 3.2) {
      outlines.push([...points, points[0]]);
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
          // Short overlapping stitches give the thread a sewn surface, not a flat fill.
          for (let x = start; x < end; x += 14) {
            const wobble = Math.sin(x * 1.7 + y * 2.4) * .5;
            stitches.push({ a: point(x,y+wobble), b: point(Math.min(x+14.6,end),y+.65+wobble), colour, width: 2.9 });
          }
        }
      }
    }
    function ellipse(cx,cy,rx,ry,angle,colour) {
      const points = [];
      for (let i=0;i<64;i++) { const t=i*Math.PI/32,x=rx*Math.cos(t),y=ry*Math.sin(t); points.push(point(cx+x*Math.cos(angle)-y*Math.sin(angle),cy+x*Math.sin(angle)+y*Math.cos(angle))); }
      satin(points,colour);
    }
    function leaf(a,b,c,d,colour) {
      const points=curve(a,b,c,d,24).concat(curve(d,[c[0]-24,c[1]+35],[b[0]-12,b[1]+32],a,24));
      satin(points,colour);run(curve(a,[(a[0]+d[0])/2,a[1]],[(a[0]+d[0])/2,d[1]],d,18),colours.green,1.9);
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
      satin(left,colours.light);satin(right,colours.light);
      run(curve([190,249],[208,236],[259,270],[285,285]),colours.main,4);
      run(curve([413,245],[385,244],[349,267],[316,284]),colours.main,4);
      run(curve([270,325],[245,351],[214,367],[201,389]),colours.light,4);
      run(curve([321,329],[330,355],[339,378],[357,397]),colours.light,4);
      ellipse(299,288,21,24,.12,colours.main);
      run(curve([293,269],[286,280],[289,296],[296,305],14),colours.light,3);
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
    const result={stitches,outlines};cache.set(key,result);return result;
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
    ctx.strokeStyle='#fff';ctx.globalAlpha=alpha*.22;ctx.lineWidth=.65;
    ctx.beginPath();ctx.moveTo(s.a.x+.3,s.a.y-.7);ctx.lineTo(s.b.x-.5,s.b.y-.7);ctx.stroke();
    ctx.globalAlpha=alpha*.1;ctx.strokeStyle='#2e1d1d';ctx.lineWidth=.6;
    ctx.beginPath();ctx.moveTo(s.a.x,s.a.y+1.1);ctx.lineTo(s.b.x,s.b.y+1.1);ctx.stroke();ctx.globalAlpha=1;
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
    const design=pattern(id,palette),n=Math.floor(design.stitches.length*Math.max(0,Math.min(1,progress)));
    if(progress<1&&!options.thumbnail){ctx.lineWidth=1;ctx.strokeStyle='#b398aa42';ctx.setLineDash([2,4]);for(const points of design.outlines){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}ctx.setLineDash([]);}
    for(let i=0;i<n;i++) drawThread(ctx,design.stitches[i]);
    if(options.active&&n<design.stitches.length){
      const s=design.stitches[n],phase=(options.time||0)/500,tip=s.a;
      ctx.strokeStyle=palettes[palette].main;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(tip.x,tip.y);ctx.bezierCurveTo(tip.x+25,tip.y-70,tip.x+85,tip.y+15,tip.x+105,tip.y-38);ctx.stroke();
      ctx.save();ctx.translate(tip.x,tip.y+Math.sin(phase)*3);ctx.rotate(-.55);ctx.strokeStyle='#66666b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-50);ctx.stroke();ctx.strokeStyle='#e6e7e9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-.5,-3);ctx.lineTo(-.5,-48);ctx.stroke();ctx.fillStyle='#56545c';ctx.beginPath();ctx.ellipse(0,-44,.6,2.8,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(!options.thumbnail){ctx.fillStyle='#b2a28f';ctx.textAlign='center';ctx.font='italic 15px Georgia';ctx.fillText(progress>=1?'a little time, a little thread':'one stitch at a time',300,491);}
    ctx.restore();return {done:n,total:design.stitches.length};
  }
  root.Embroidery={draw,pattern,palettes,names};
})(globalThis);
