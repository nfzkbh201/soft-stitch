const test = require('node:test');
const assert = require('node:assert/strict');
require('../dist/data.js');
require('../dist/embroidery.js');
const E = globalThis.Embroidery;
const stitch = { a:{x:250,y:300}, b:{x:272,y:312}, width:2.5, colour:'#ae3959' };
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} should equal ${b}`);

test('needle starts below the cloth, emerges tip-first, then disappears eye-last', () => {
  assert.equal(E.needlePose(stitch,.03).visible,false);
  const rising=E.needlePose(stitch,.14),raised=E.needlePose(stitch,.29);
  assert.equal(rising.stage,'emerge');assert.ok(rising.to<1);assert.ok(rising.eye.z<0);
  assert.equal(raised.to,1);assert.ok(raised.eye.z>0);
  const early=E.needlePose(stitch,.64),late=E.needlePose(stitch,.76);
  assert.equal(early.stage,'pierce');assert.ok(early.from>0);assert.ok(late.from>early.from);
  assert.equal(E.needlePose(stitch,.83).visible,false);
  assert.equal(E.needlePose(stitch,.9).visible,false);
});
test('the cloth-plane intersection stays exactly at each puncture', () => {
  for(const phase of [.08,.12,.18,.22]){
    const pose=E.needlePose(stitch,phase),intersection=pose.at(pose.to);
    close(intersection.x,stitch.a.x);close(intersection.y,stitch.a.y);close(intersection.z,0);
  }
  for(const phase of [.6,.65,.7,.76]){
    const pose=E.needlePose(stitch,phase),intersection=pose.at(pose.from);
    close(intersection.x,stitch.b.x);close(intersection.y,stitch.b.y);close(intersection.z,0);
  }
});
test('no visible needle segment is below the fabric', () => {
  for(let i=0;i<=1000;i++){
    const pose=E.needlePose(stitch,i/1000);
    if(!pose.visible)continue;
    assert.ok(pose.at(pose.from).z>=-1e-8);assert.ok(pose.at(pose.to).z>=-1e-8);
    assert.ok(pose.from>=0&&pose.to<=1&&pose.from<pose.to);
  }
});
test('thread pulls taut only after the needle passes below the cloth', () => {
  const loose=E.needlePose(stitch,.84),pulling=E.needlePose(stitch,.9),taut=E.needlePose(stitch,.97);
  assert.equal(loose.visible,false);assert.ok(loose.slack>pulling.slack);assert.equal(taut.slack,0);
  assert.deepEqual(taut.end,stitch.b);assert.equal(taut.holeAmount,0);
});
test('fast previews keep one target for a readable needle cycle', () => {
  const total=653,duration=8500,batch=Math.ceil(total*1400/duration);
  const rising=E.stitchFrame(total,batch*.15/total,duration),piercing=E.stitchFrame(total,batch*.72/total,duration);
  assert.equal(rising.index,piercing.index);assert.equal(rising.done,0);assert.equal(piercing.done,0);
  assert.ok(batch/total*duration>=1400);
  let last=0;
  for(let i=0;i<=1000;i++){
    const frame=E.stitchFrame(total,i/1000,duration);
    assert.ok(frame.done>=last&&frame.done<=total);assert.ok(frame.phase>=0&&frame.phase<=1);last=frame.done;
  }
  assert.equal(last,total);
});
test('normal focus sessions sew individual stitches without batching', () => {
  const rising=E.stitchFrame(653,200.2/653,25*60000),piercing=E.stitchFrame(653,200.7/653,25*60000);
  assert.equal(rising.index,200);assert.equal(piercing.index,200);assert.equal(rising.done,200);
  assert.equal(E.stitchFrame(653,1,25*60000).done,653);
});
