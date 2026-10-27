// Offline CLI fixture. Never calls the network or uses real credentials.
import { appendFile } from 'node:fs/promises';
let accepted=0;
globalThis.fetch=async(input,options={})=>{
 const url=String(input);await appendFile('calls.jsonl',JSON.stringify({url,method:options.method||'GET',headers:options.headers})+'\n');
 if(url==='https://cdn.example.test/video.mp4') return new Response(new Uint8Array([0,1,2,3]),{headers:{'content-type':'video/mp4'}});
 if(url.endsWith('/render/validate/api-key')) {const name=JSON.parse(options.body).payload.name;return Response.json({valid:true,creditsRequired:process.env.FIXTURE==='over-budget'?50:name.endsWith('tiktok')?12:14,warnings:[]});}
 if(url.endsWith('/render/api-key')) {if(process.env.FIXTURE==='lost-response')throw Error('simulated lost response');return Response.json({jobId:`job-${++accepted}`,queued:true});}
 if(url.includes('/jobs/')) return Response.json({state:'completed',progress:100,result:{url:'https://cdn.example.test/video.mp4'}});
 throw Error(`Unexpected offline URL: ${url}`);
};
