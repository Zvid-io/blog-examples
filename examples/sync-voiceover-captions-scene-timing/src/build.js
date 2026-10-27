import {buildRequest, timingSummary} from './project.js';
import {readJson, saveJson, prepareOutput} from './helpers.js';
await prepareOutput();
const record=await readJson('data/timing.json');
await saveJson('out/request.json', buildRequest(record));
await saveJson('out/timing-summary.json', timingSummary(record));
console.log('Saved out/request.json and out/timing-summary.json. No network request or render.');
