import assert from 'node:assert/strict';

function dateLabel(value, name) {
  assert.ok(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), `${name} must be an ISO calendar date (YYYY-MM-DD).`);
  const date = new Date(value + 'T00:00:00Z');
  assert.ok(Number.isFinite(date.valueOf()) && date.toISOString().slice(0,10) === value, `${name} is not a real calendar date.`);
  return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(date).toUpperCase();
}

// Copy bounds and approval flags belong to this teaching application, not Zvid.
export function variablesFor(record) {
  const object = (v,name) => assert.ok(v && typeof v === 'object' && !Array.isArray(v), `${name} must be an object.`);
  const text = (v,max,name) => assert.ok(typeof v === 'string' && v.trim() && v.length <= max && !/[<>{}]/.test(v), `${name} must contain 1-${max} plain-text characters, without markup or placeholders.`);
  object(record,'record');
  assert.ok(Object.keys(record).every(k=>['showName','editionDate','stories'].includes(k)), 'Unknown brief field.');
  text(record.showName,28,'showName');
  const dateLine=dateLabel(record.editionDate,'editionDate');
  assert.ok(Array.isArray(record.stories) && record.stories.length >= 1 && record.stories.length <= 3,'stories must contain one to three entries.');
  const ids=new Set(),urls=new Set();
  const stories=record.stories.map((story,i)=>{
    object(story,'story');
    assert.ok(Object.keys(story).every(k=>['id','tag','title','summary','sourceName','sourceUrl','publishedAt','approved'].includes(k)), 'Unknown story field.');
    for(const [key,max] of [['id',40],['tag',14],['title',48],['summary',76],['sourceName',22]])text(story[key],max,key);
    assert.match(story.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'id must be a lowercase slug.');
    assert.equal(story.approved,true,'Every story must have approved: true. This flag is an application gate, not factual verification.');
    const source=new URL(story.sourceUrl);
    assert.ok(source.protocol==='https:' && !source.username && !source.password,'sourceUrl must be a public HTTPS URL without credentials.');
    source.hash='';
    assert.ok(!ids.has(story.id) && !urls.has(source.href),'Duplicate story ID or source URL.');
    ids.add(story.id);urls.add(source.href);
    const sourceDate=dateLabel(story.publishedAt,'publishedAt');
    assert.ok(story.publishedAt <= record.editionDate,'Story publication date is later than the edition date.');
    return {number:String(i+1).padStart(2,'0'),tag:story.tag,title:story.title,summary:story.summary,sourceLine:story.sourceName+' / '+sourceDate};
  });
  return {showName:record.showName,dateLine,storyCount:String(stories.length),stories};
}

export const expectedTimeline=variables=>({sceneCount:variables.stories.length+2,duration:7+7*variables.stories.length});

export function checkResolved(project, variables) {
  const expected=expectedTimeline(variables);
  assert.equal(project.scenes?.length,expected.sceneCount,'Resolved scene count is wrong.');
  assert.ok(Math.abs(project.duration-expected.duration)<0.001,'Resolved duration is wrong.');
  assert.deepEqual(project.scenes.map(s=>s.id),['opening',...variables.stories.map((_,i)=>`story-${i+1}`),'closing'],'Resolved scene order is wrong.');
  const texts=s=>s.visuals.filter(v=>v.type==='TEXT').map(v=>v.text);
  assert.ok(texts(project.scenes[0]).includes(variables.showName),'Resolved show name is wrong.');
  variables.stories.forEach((s,i)=>{
    for(const value of [s.number,s.tag,s.title,s.summary,s.sourceLine])assert.ok(texts(project.scenes[i+1]).includes(value),'Resolved story copy or source label is wrong.');
  });
  for(const s of project.scenes) {
    assert.ok(texts(s).includes(variables.dateLine),'Resolved edition date is wrong.');
    assert.ok(texts(s).some(t=>t.includes('FICTIONAL DEMO')),'Fictional demo disclosure is missing.');
  }
  assert.ok(!JSON.stringify(project).includes('{{'),'A placeholder did not resolve.');
  return expected;
}

export async function prepareStories(api, template, record, save) {
  const variables=variablesFor(record);
  const quote=await api.authoring.validate({payload:template,variables});
  await save('out/validation.json',quote);
  if(!quote.valid)throw new Error('Validation failed. Read out/validation.json.');
  const expected=checkResolved(quote.payload,variables);
  await save('out/resolved-project.json',quote.payload);
  return {request:{payload:quote.payload},quote,expected};
}
