import {buildRequest} from './project.js';
import {readJson,saveJson,prepareOutput} from './helpers.js';
await prepareOutput();
await saveJson('out/request.json',buildRequest(await readJson('data/cue-sheet.json')));
console.log('Saved out/request.json. No network request or render.');
