import {buildRequest} from './project.js';
import {readJson,saveJson,prepareOutput} from './helpers.js';
await prepareOutput();
await saveJson('out/candidate-request.json',buildRequest(await readJson('data/story.json')));
console.log('Saved out/candidate-request.json. No network request or render.');
