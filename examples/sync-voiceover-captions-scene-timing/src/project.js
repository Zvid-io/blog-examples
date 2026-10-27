// The three-scene limit and centisecond policy belong to this teaching example.
// Zvid itself supports other scene counts and timings.
const round=value=>Math.round(value*100)/100;
function time(value,label){if(!Number.isFinite(value)||value<0||Math.abs(round(value)-value)>1e-8)throw Error(`${label} must be nonnegative seconds with at most two decimal places.`);return value;}
function text(value,label,max=90){if(typeof value!=='string'||!value.trim()||value.length>max||/[<>\r\n]/.test(value))throw Error(`${label} must be a nonempty single line of at most ${max} characters without angle brackets.`);return value.trim();}
export function validateTiming(record){
  if(record?.reviewed!==true)throw Error('Review the recording, caption words and scene cues, then set reviewed to true.');
  const duration=time(record.duration,'duration');if(duration<=0||duration>30)throw Error('This example needs duration in (0, 30].');
  time(record.audioEnd,'audioEnd');if(record.audioEnd<=0||record.audioEnd>duration)throw Error('audioEnd must be positive and no later than duration.');
  text(record.revision,'revision');
  if(new URL(record.audioUrl).protocol!=='https:')throw Error('audioUrl must use HTTPS.');
  if(!Array.isArray(record.segments)||record.segments.length!==3)throw Error('This layout requires exactly three segments.');
  let cursor=0;const ids=new Set();
  for(const [i,s] of record.segments.entries()){
    text(s.id,'id',30);if(ids.has(s.id))throw Error('Scene ids must be unique.');ids.add(s.id);
    time(s.start,'segment start');time(s.end,'segment end');
    if(s.start!==cursor||s.end<=s.start||s.end>duration)throw Error('Segments must be contiguous from zero to duration.');
    text(s.heading,'heading',28);text(s.label,'label',22);
    const overlap=time(s.overlap,'overlap');if(i===2&&overlap!==0)throw Error('The final scene must have zero overlap.');
    if(!Array.isArray(s.captions)||!s.captions.length)throw Error('Every segment needs captions.');
    let previous=s.start;
    for(const c of s.captions){
      time(c.start,'caption start');time(c.end,'caption end');
      if(c.start<previous||c.end<=c.start||c.end>s.end||c.end>record.audioEnd)throw Error('Captions must be ordered, nonoverlapping, inside their segment and no later than audioEnd.');
      text(c.text,'caption');if(!Array.isArray(c.words)||!c.words.length)throw Error('Supply reviewed word timings.');
      let wordEnd=c.start;
      for(const w of c.words){text(w.text,'word');time(w.start,'word start');time(w.end,'word end');if(w.start<wordEnd||w.end<=w.start||w.end>c.end)throw Error('Word timings must be ordered and contained in their caption.');wordEnd=w.end;}
      if(c.words.map(w=>w.text).join(' ')!==c.text)throw Error('Caption text must match its word list.');previous=c.end;
    }
    time(s.cue.start,'cue start');time(s.cue.end,'cue end');text(s.cue.text,'cue text',26);
    if(s.cue.start<s.start||s.cue.end<=s.cue.start||s.cue.end>s.end)throw Error('Visual cue must fit its segment.');
    cursor=s.end;
  }
  if(cursor!==duration)throw Error('The last segment must end at duration.');
  const durations=record.segments.map(s=>round(s.end-s.start+s.overlap));
  for(let i=0;i<2;i++)if(record.segments[i].overlap>=Math.min(durations[i],durations[i+1]))throw Error('Overlap must be shorter than both adjacent scenes.');
  return durations;
}
export function timingSummary(record){
  const durations=validateTiming(record);let cursor=0;
  const scenes=record.segments.map((s,i)=>{const row={id:s.id,globalStart:cursor,duration:durations[i],overlap:s.overlap,cueGlobalStart:s.cue.start,cueLocalStart:round(s.cue.start-cursor)};cursor=round(cursor+durations[i]-s.overlap);return row;});
  return {revision:record.revision,duration:cursor,scenes};
}
const layer=(value,x,y,width,height,size,color,extra={})=>({type:'TEXT',text:value,position:'custom',anchor:'top-left',x,y,width,height,fitToBox:true,style:{fontFamily:'Inter',fontSize:`${size}px`,fontWeight:700,color,lineHeight:1.15},...extra});
export function buildRequest(record){
  const durations=validateTiming(record),colors=['#E7E0F3','#DDEBE3','#F6E5D9'];
  const scenes=record.segments.map((s,i)=>({id:s.id,duration:durations[i],backgroundColor:colors[i],...(s.overlap?{transition:'fade',transitionDuration:s.overlap}:{}),visuals:[
    layer(`0${i+1} / ONE TIMING RECORD`,70,65,1140,40,24,'#476556'),
    layer(s.heading,70,145,1140,110,70,'#123D32'),
    layer(s.label,70,290,1140,55,30,'#476556'),
    layer(s.cue.text,70,390,1140,75,44,'#B14831',{enterBegin:round(s.cue.start-s.start),exitEnd:round(s.cue.end-s.start)})
  ]}));
  return {payload:{name:'sync-timing-demo',width:1280,height:720,frameRate:30,outputFormat:'mp4',duration:record.duration,backgroundColor:'#E7E0F3',scenes,
    audios:[{src:record.audioUrl,enter:0,exit:record.audioEnd,audioBegin:0,audioEnd:record.audioEnd,volume:1,speed:1}],
    subtitle:{captions:record.segments.flatMap(s=>s.captions),animation:'highlight',activeWord:{color:'#123D32',background:'#FFB798',radius:5},font:{family:'Inter',size:34,color:'#FFF8EC',bold:true},background:{color:'#163E33',opacity:1,padding:18,radius:9},position:'bottom-center',margin:{x:70,y:70}}}};
}
