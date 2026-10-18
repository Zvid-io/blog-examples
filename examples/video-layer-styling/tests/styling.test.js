import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkQuote, outputUrl, trackJob, downloadVideo } from '../src/helpers.js';
const project=JSON.parse(fs.readFileSync(new URL('../data/project.json',import.meta.url)));
test('comparison keeps source time and geometry consistent while adding one style at each step',()=>{
 const cards=project.visuals.filter(v=>v.type==='VIDEO');assert.equal(cards.length,4);
 for(const c of cards){assert.equal(c.src,cards[0].src);assert.equal(c.volume,0);assert.equal(c.videoBegin,0);assert.equal(c.videoEnd,6);assert.equal(c.exitEnd,6);assert.equal(c.width,224);assert.equal(c.height,398);assert.equal(c.position,'custom');assert.equal(c.anchor,'center-center');}
 assert.equal(cards[0].radius,undefined);assert.equal(cards[1].angle,undefined);assert.equal(cards[2].filter,undefined);
 assert.deepEqual(cards[1].radius,{tl:28,tr:28,bl:28,br:28});assert.deepEqual(cards[1].radius,cards[3].radius);assert.equal(cards[2].angle,-6);assert.equal(cards[3].angle,-6);assert.deepEqual(cards[3].filter,{saturate:-100});
 for(const c of cards){const a=Math.abs(c.angle||0)*Math.PI/180;const w=c.width*Math.cos(a)+c.height*Math.sin(a);const h=c.height*Math.cos(a)+c.width*Math.sin(a);assert.ok(c.x-w/2>=0&&c.x+w/2<=1280&&c.y-h/2>=0&&c.y+h/2<=720);}
});
test('quote guard refuses missing, excessive or warning-bearing estimates',()=>{
 checkQuote({valid:true,creditsRequired:6},6);
 for(const q of [{valid:false},{valid:true},{valid:true,creditsRequired:7},{valid:true,creditsRequired:6,warnings:['cropped']}])assert.throws(()=>checkQuote(q,6));
 assert.throws(()=>checkQuote({valid:true,creditsRequired:6},NaN));
});
test('100 percent active is not completion, and failed jobs stop',async()=>{
 const queue=[{state:'active',progress:100},{state:'completed',result:'https://cdn.zvid.io/test.mp4'}];let count=0;
 await trackJob({jobs:{get:async()=>{count++;return queue.shift();}}},'job',{intervalMs:0,log:()=>{}});assert.equal(count,2);
 await assert.rejects(trackJob({jobs:{get:async()=>({state:'failed',failedReason:'Source unavailable'})}},'job',{log:()=>{}}),/Source unavailable/);
 assert.throws(()=>outputUrl({state:'completed',result:'https://cdn.zvid.io/test.mp4',outputExpiredAt:'2026-01-01'}),/expired/);
});
test('download rejects HTML and sends no API key to media host',async()=>{
 await assert.rejects(downloadVideo('https://cdn.zvid.io/test.mp4','unused.mp4',async(u,init)=>{assert.equal(init.headers,undefined);return new Response('<html>failure</html>',{headers:{'content-type':'text/html'}});}),/video media/);
});
