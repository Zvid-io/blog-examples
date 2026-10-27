// Input policies below keep this three-card teaching layout readable.
// They are choices of this example application, not limits of the Zvid schema.
function text(value,label,max=80){
  if(typeof value!=='string'||!value.trim()||value.length>max||/[<>\r\n]/.test(value))throw Error(`${label} must be one line of 1-${max} characters without angle brackets.`);
  return value.trim();
}
export function buildRequest(story){
  if(!story||story.reviewed!==true)throw Error('Review the narration, timings and note values, then set reviewed to true.');
  if(!Array.isArray(story.segments)||story.segments.length!==3)throw Error('This example requires exactly three note segments.');
  if(!Number.isFinite(story.duration)||story.duration<=0||story.duration>30)throw Error('duration must be greater than zero and at most 30 seconds.');
  const audioUrl=new URL(story.narrationUrl);if(audioUrl.protocol!=='https:')throw Error('narrationUrl must use HTTPS.');
  const title=text(story.title,'title',30);let cursor=0;const ids=new Set();const captions=[];
  const rowValues=story.segments.map((s,i)=>({label:text(s.label,`segments[${i}].label`,16),value:text(s.value,`segments[${i}].value`,32)}));
  const layer=(value,x,y,width,height,size,color,extra={})=>({type:'TEXT',text:value,position:'custom',x,y,width,height,anchor:'top-left',fitToBox:true,style:{fontFamily:'Inter',fontSize:`${size}px`,fontWeight:700,color,lineHeight:1.15,...extra}});
  const scenes=story.segments.map((segment,i)=>{
    if(typeof segment.id!=='string'||!segment.id||ids.has(segment.id))throw Error('Segment ids must be nonempty and unique.');ids.add(segment.id);
    if(!Number.isFinite(segment.start)||!Number.isFinite(segment.end)||Math.abs(segment.start-cursor)>0.0001||segment.end<=segment.start||segment.end>story.duration)throw Error('Segments must be contiguous, start at zero and stay within duration.');
    if(!Array.isArray(segment.captions)||segment.captions.length===0)throw Error('Every segment needs prepared captions.');
    let captionEnd=segment.start;
    for(const cue of segment.captions){
      if(!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.start<captionEnd||cue.start<segment.start||cue.end<=cue.start||cue.end>segment.end)throw Error('Captions must be ordered, nonoverlapping and inside their segment.');
      captions.push({start:cue.start,end:cue.end,text:text(cue.text,'caption',90)});captionEnd=cue.end;
    }
    const visuals=[layer('BETTER MEETING NOTES',64,140,590,40,22,'#CFC2DA',{letterSpacing:'3px'}),layer(title,64,210,590,130,62,'#FFF6E8')];
    rowValues.forEach((row,j)=>{
      const active=j===i, revealed=j<=i;
      visuals.push(layer(`${j+1}. ${row.label.toUpperCase()}`,88,420+j*146,540,34,22,active?'#FF916E':'#CFC2DA'));
      visuals.push(layer(revealed?row.value:'...',88,464+j*146,540,70,active?42:36,revealed?'#FFF6E8':'#776681',{fontWeight:active?800:500}));
    });
    visuals.push(layer('FICTIONAL MEETING EXAMPLE',64,920,590,28,16,'#CFC2DA',{letterSpacing:'2px'}));
    cursor=segment.end;return {id:segment.id,duration:Math.round((segment.end-segment.start)*1000)/1000,visuals};
  });
  if(Math.abs(cursor-story.duration)>0.0001)throw Error('The final segment must end at duration.');
  return {payload:{name:'faceless-meeting-notes',width:720,height:1280,frameRate:30,outputFormat:'mp4',duration:story.duration,backgroundColor:'#24142F',scenes,
    audios:[{src:audioUrl.href,enter:0,exit:story.duration,volume:1}],
    subtitle:{captions,animation:'normal',font:{family:'Inter',size:32,color:'#FFF9EF',bold:true},background:{color:'#110A1B',opacity:0.96,padding:16,radius:8},position:'bottom-center',margin:{x:48,y:150}}}};
}
