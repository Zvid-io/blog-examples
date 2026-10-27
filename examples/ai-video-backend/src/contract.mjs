import fs from 'node:fs';

export const readJson = file => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'));

function exactKeys(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${path}: expected object`);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw Error(`${path}/${key}: required`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw Error(`${path}/${key}: unexpected field`);
}
function plainText(value, maximum, path, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > maximum || /[<>{}\u0000-\u001f\u007f]/u.test(value)) {
    throw Error(`${path}: expected plain text, ${allowEmpty ? 0 : 1}-${maximum} characters`);
  }
}
export function validateProposal(proposal, sources) {
  exactKeys(proposal, ['schemaVersion', 'title', 'features', 'showCta', 'cta'], 'proposal');
  if (proposal.schemaVersion !== 'feature-explainer@1') throw Error('proposal/schemaVersion: unsupported version');
  plainText(proposal.title, 40, 'proposal/title');
  if (!Array.isArray(proposal.features) || proposal.features.length < 2 || proposal.features.length > 4) throw Error('proposal/features: expected 2-4 items');
  proposal.features.forEach((feature, i) => {
    const path = `proposal/features/${i}`;
    exactKeys(feature, ['heading', 'body', 'sourceRef'], path);
    plainText(feature.heading, 20, path + '/heading');
    plainText(feature.body, 72, path + '/body');
    if (typeof feature.sourceRef !== 'string' || !Object.hasOwn(sources, feature.sourceRef)) throw Error(path + '/sourceRef: unknown source');
  });
  if (typeof proposal.showCta !== 'boolean') throw Error('proposal/showCta: expected boolean');
  plainText(proposal.cta, 40, 'proposal/cta', !proposal.showCta);
  // Source membership is checked, not whether the cited source supports the words.
  return proposal;
}
export function toVariables(proposal, sources) {
  validateProposal(proposal, sources);
  return { title: proposal.title, features: proposal.features.map(({ heading, body }) => ({ heading, body })), showCta: proposal.showCta, cta: proposal.cta };
}
export function buildRequest(proposal, design, sources) {
  return { payload: structuredClone(design), variables: toVariables(proposal, sources) };
}
export function makeCases() {
  const proposal = readJson('data/proposal.json');
  const sources = readJson('data/sources.json');
  const design = readJson('templates/explainer.json');
  const noCta = { ...proposal, showCta: false };
  const newDesign = { ...design, backgroundColor: '#392743' };
  const unsupported = structuredClone(proposal);
  unsupported.features[0].body = 'Saves every team ten hours a week.';
  return [
    { name: 'baseline', request: buildRequest(proposal, design, sources), scenes: 5, seconds: 13 },
    { name: 'no-cta', request: buildRequest(noCta, design, sources), scenes: 4, seconds: 11 },
    { name: 'design-change', request: buildRequest(proposal, newDesign, sources), scenes: 5, seconds: 13 },
    { name: 'unsupported-claim', request: buildRequest(unsupported, design, sources), scenes: 5, seconds: 13 },
  ];
}
