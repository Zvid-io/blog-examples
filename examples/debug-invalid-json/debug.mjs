// Keep the article's direct command available from the example folder.
import { pathToFileURL } from 'node:url';
import { main } from './src/debug.mjs';
export * from './src/debug.mjs';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
