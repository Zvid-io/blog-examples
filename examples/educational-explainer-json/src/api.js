import {timedFetch} from './helpers.js';

export function createApi(apiKey, fetcher = timedFetch) {
  async function request(method, path, body, options = {}) {
    const response = await fetcher('https://api.zvid.io' + path, {
      method, headers: {'x-api-key': apiKey, 'Content-Type': 'application/json'},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}), ...options,
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`HTTP ${response.status}: expected JSON from the API.`); }
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${data.message || data.error || 'Request failed'}`);
      error.status = response.status; error.body = data; throw error;
    }
    return data;
  }
  return {
    request,
    authoring: {validate: input => request('POST', '/api/render/validate/api-key', input)},
    renders: {create: input => request('POST', '/api/render/api-key', input)},
    jobs: {get: (id, options) => request('GET', '/api/jobs/' + encodeURIComponent(id), undefined, options)},
  };
}
