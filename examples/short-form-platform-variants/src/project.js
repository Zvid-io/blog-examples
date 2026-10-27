// These bounds protect this particular layout. They are not platform or Zvid limits.
export function shortText(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[<>\r\n]/.test(value))
    throw new Error(`${label} must be one line of 1-${maximum} characters without angle brackets.`);
  return value.trim();
}
export function buildVariants(content, profiles) {
  const contentId = shortText(content?.contentId, 'contentId', 48);
  const series = shortText(content?.series, 'series', 24);
  if (!Array.isArray(content.beats) || content.beats.length !== 3) throw new Error('This example needs exactly three beats.');
  if (!Number.isFinite(content.secondsPerBeat) || content.secondsPerBeat < 3 || content.secondsPerBeat > 8) throw new Error('secondsPerBeat must be between 3 and 8.');
  const beats = content.beats.map((beat, i) => ({title: shortText(beat.title, `beats[${i}].title`,40), detail: shortText(beat.detail,`beats[${i}].detail`,64)}));
  if (!Array.isArray(profiles) || profiles.length !== 3) throw new Error('This example needs three profiles.');
  const ids = new Set();
  return profiles.map(profile => {
    if (!['tiktok','reels','shorts'].includes(profile.id) || ids.has(profile.id)) throw new Error('Use each of tiktok, reels and shorts once.');
    ids.add(profile.id);
    shortText(profile.revision, 'profile revision', 32);
    const {textX:x,textWidth:w,titleY:y} = profile;
    if (![x,w,y].every(Number.isFinite) || x<80 || x+w>940 || w<600 || y<560 || y>760) throw new Error('Profile text boxes exceed this example layout.');
    if (profile.endCard !== null) shortText(profile.endCard, 'endCard', 40);
    const text = (value, top, height, size, color='#F6EFE2', extra={}) => ({type:'TEXT',text:value,x,y:top,width:w,height,anchor:'top-left',fitToBox:true,style:{fontFamily:'Inter',fontSize:`${size}px`,fontWeight:800,color,lineHeight:1.08,...extra}});
    const scenes = beats.map((beat,i)=>({id:`beat-${i+1}`,duration:content.secondsPerBeat,visuals:[
      text(series,340,70,32,'#F6EFE2',{letterSpacing:'4px'}),
      text(String(i+1).padStart(2,'0'),470,120,100,'#FF805E'),
      text(beat.title,y,400,112,'#F6EFE2',{textTransform:'uppercase'}),
      text(beat.detail,y+440,180,42,'#D0C4D6',{fontWeight:500,lineHeight:1.3}),
      text(`${i+1} / 3`,1460,60,28,'#FF805E',{fontWeight:600})
    ]}));
    if (profile.endCard) scenes.push({id:'end-card',duration:2,visuals:[text(series,500,70,32,'#F6EFE2',{letterSpacing:'4px'}),text(profile.endCard,760,440,100,'#F6EFE2'),text('ONE CALL. ONE CLEAR NEXT STEP.',1280,100,30,'#FF805E')]});
    return {id:profile.id,contentId,profileRevision:profile.revision,duration:scenes.reduce((s,v)=>s+v.duration,0),request:{payload:{name:`${contentId}-${profile.id}`,width:1080,height:1920,frameRate:30,outputFormat:'mp4',backgroundColor:'#24142F',scenes}}};
  });
}
