import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const readJson = relative => JSON.parse(fs.readFileSync(new URL('../' + relative, import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, coerceTypes: false });
addFormats(ajv);
const validate = ajv.compile(readJson('input.schema.json'));

export function validateProduct(product) {
  if (!validate(product)) {
    throw new Error('Invalid product: ' + ajv.errorsText(validate.errors, { dataVar: 'product' }));
  }
  if (!product.name.trim()) throw new Error('Invalid product: name must not be blank');
  return product;
}

export function toTemplateValues(product) {
  validateProduct(product);
  return {
    productName: product.name,
    priceText: '$' + (product.priceCents / 100).toFixed(2),
    productImage: product.imageUrl,
  };
}

// Application-owned policy for these simple, flat templates, not a Zvid schema.
// This deliberately does not implement scene scopes, conditions or iteration.
const requiredVariables = ['priceText', 'productImage', 'productName'];
export function assertTemplateContract(project) {
  const { variables, ...design } = project;
  const declared = Object.keys(variables ?? {}).sort();
  const consumed = [...new Set([...JSON.stringify(design).matchAll(/\{\{([a-zA-Z]\w*)\}\}/g)].map(m => m[1]))].sort();
  for (const [label, names] of [['declared', declared], ['consumed', consumed]]) {
    if (JSON.stringify(names) !== JSON.stringify(requiredVariables)) {
      throw new Error(`Template contract changed: ${label} [${names.join(', ')}]; expected [${requiredVariables.join(', ')}]`);
    }
  }
}

export function buildRequest(product, design) {
  const variables = toTemplateValues(product);
  assertTemplateContract(design);
  return { payload: design, variables };
}

export function inspectResolved(project) {
  const visuals = project.visuals ?? [];
  const text = visuals.filter(v => v.type === 'TEXT');
  return {
    productName: text[1]?.text ?? null,
    priceText: text[2]?.text ?? null,
    productImage: visuals.find(v => v.type === 'IMAGE')?.src ?? null,
    backgroundColor: project.backgroundColor,
  };
}
