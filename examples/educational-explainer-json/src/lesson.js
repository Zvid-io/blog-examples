import assert from 'node:assert/strict';

// These copy limits protect this example's fixed layout; they are not Zvid limits.
export function variablesFor(lesson) {
  assert.ok(lesson && typeof lesson === 'object' && !Array.isArray(lesson), 'lesson must be an object.');
  const allowed = ['course','title','goal','points','showExample','exampleTitle','exampleBody','takeaway','limitation'];
  assert.ok(Object.keys(lesson).every(k => allowed.includes(k)), 'Unknown lesson field.');
  const text = (value, max, name) => assert.ok(typeof value === 'string' && value.trim() && value.length <= max && !/[<>{}]/.test(value), `${name} must be plain text, 1-${max} characters, without HTML or placeholders.`);
  for (const [key,max] of [['course',24],['title',56],['goal',64],['exampleTitle',40],['exampleBody',100],['takeaway',56],['limitation',80]]) text(lesson[key],max,key);
  assert.equal(typeof lesson.showExample,'boolean','showExample must be a Boolean.');
  assert.ok(Array.isArray(lesson.points) && lesson.points.length >= 1 && lesson.points.length <= 3,'points must contain one to three entries.');
  const points = lesson.points.map((p,i) => {
    assert.ok(p && typeof p === 'object' && !Array.isArray(p),'Each point must be an object.');
    assert.ok(Object.keys(p).every(k => ['heading','body'].includes(k)),'Unknown point field.');
    text(p.heading,24,'point.heading'); text(p.body,90,'point.body');
    return {number:String(i+1).padStart(2,'0'),heading:p.heading,body:p.body};
  });
  return {...lesson,points};
}

export function expectedTimeline(variables) {
  return {sceneCount:2+variables.points.length+(variables.showExample?1:0),duration:9+5*variables.points.length+(variables.showExample?6:0)};
}

export function checkResolved(project, variables) {
  const expected=expectedTimeline(variables);
  assert.equal(project.scenes?.length,expected.sceneCount,'Resolved scene count is wrong.');
  assert.ok(Math.abs(project.duration-expected.duration)<0.001,'Resolved duration is wrong.');
  assert.deepEqual(project.scenes.map(s=>s.id),['opening',...variables.points.map((_,i)=>`point-${i+1}`),...(variables.showExample?['example']:[]),'takeaway'],'Resolved scene order is wrong.');
  const text=scene=>scene.visuals.filter(e=>e.type==='TEXT').map(e=>e.text);
  assert.ok(text(project.scenes[0]).includes(variables.title),'Resolved title is wrong.');
  variables.points.forEach((p,i)=>{
    for(const value of [p.number,p.heading,p.body]) assert.ok(text(project.scenes[i+1]).includes(value),'Resolved point content is wrong.');
  });
  if(variables.showExample) for(const value of [variables.exampleTitle,variables.exampleBody]) assert.ok(text(project.scenes.at(-2)).includes(value),'Resolved example content is wrong.');
  for(const value of [variables.takeaway,variables.limitation]) assert.ok(text(project.scenes.at(-1)).includes(value),'Resolved takeaway content is wrong.');
  assert.ok(!JSON.stringify(project).includes('{{'),'A placeholder did not resolve.');
  return expected;
}

export async function prepareLesson(api, template, lesson, save) {
  const variables=variablesFor(lesson);
  const quote=await api.authoring.validate({payload:template,variables});
  await save('out/validation.json',quote);
  if(!quote.valid) throw new Error('Validation failed. Read out/validation.json.');
  const expected=checkResolved(quote.payload,variables);
  await save('out/resolved-project.json',quote.payload);
  return {request:{payload:quote.payload},quote,expected};
}
