// These contiguous, approved, normal-speed shots are this example's input policy.
// Zvid also supports gaps, overlaps, transitions and other playback speeds.
export function buildRequest(cueSheet) {
  if (!cueSheet || typeof cueSheet.title !== 'string' || !cueSheet.title.trim()) throw new Error('The cue sheet needs a title.');
  if (!Array.isArray(cueSheet.segments) || !cueSheet.segments.length) throw new Error('The cue sheet needs segments.');
  let previousEnd = 0;
  const ids = new Set();
  const scenes = cueSheet.segments.map((shot, index) => {
    const fail = message => { throw new Error(`Segment ${index + 1}: ${message}`); };
    if (!shot || typeof shot !== 'object') fail('expected an object.');
    if (typeof shot.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(shot.id) || ids.has(shot.id)) fail('use a unique lowercase id.');
    ids.add(shot.id);
    if (shot.approved !== true) fail('review the footage and set approved to true.');
    for (const key of ['start','end','sourceBegin','sourceEnd','sourceDuration'])
      if (!Number.isFinite(shot[key])) fail(`${key} must be a number in seconds.`);
    if (shot.start < 0 || Math.abs(shot.start - previousEnd) > 1e-6 || shot.end <= shot.start) fail('shots must be contiguous and start at zero.');
    const duration = Number((shot.end - shot.start).toFixed(6));
    if (shot.sourceBegin < 0 || shot.sourceEnd > shot.sourceDuration || Math.abs(shot.sourceEnd - shot.sourceBegin - duration) > 1e-6) fail('the source trim must match the shot duration and fit inside the source.');
    if (typeof shot.label !== 'string' || !shot.label.trim() || shot.label.length > 40) fail('use a label of 1 to 40 characters.');
    if (typeof shot.visualIntent !== 'string' || !shot.visualIntent.trim()) fail('explain the visual intent.');
    let url; try { url = new URL(shot.clipUrl); } catch { fail('use an HTTPS clipUrl.'); }
    if (url.protocol !== 'https:' || url.username || url.password) fail('use an HTTPS clipUrl without credentials.');
    previousEnd = shot.end;
    return {id:shot.id,duration,visuals:[
      {type:'VIDEO',src:shot.clipUrl,videoBegin:shot.sourceBegin,videoEnd:shot.sourceEnd,width:720,height:1280,position:'center-center',resize:'cover',volume:0,speed:1,track:0,enterBegin:0,exitEnd:duration},
      {type:'TEXT',text:shot.label,position:'custom',anchor:'top-left',x:42,y:1010,width:636,height:110,track:1,enterBegin:0,exitEnd:duration,fitToBox:true,
       style:{fontFamily:'Inter',fontSize:'42px',fontWeight:700,lineHeight:'1.2',color:'#FFF8EB',backgroundColor:'#153A30',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'16px',textAlign:'center'}}
    ]};
  });
  return {payload:{name:cueSheet.title,type:'video',resolution:'custom',width:720,height:1280,frameRate:30,outputFormat:'mp4',backgroundColor:'#153A30',scenes}};
}
