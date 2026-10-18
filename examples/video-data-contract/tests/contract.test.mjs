import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, validateProduct, toTemplateValues, assertTemplateContract, buildRequest } from '../src/contract.mjs';
const product = readJson('data/product.json');
const sale = readJson('data/product-sale.json');
const a = readJson('templates/design-a.json');
const b = readJson('templates/design-b.json');

test('price change alters one mapped value and leaves the design untouched', () => {
  const before = buildRequest(product, a), after = buildRequest(sale, a);
  assert.equal(before.variables.priceText, '$24.00');
  assert.equal(after.variables.priceText, '$21.00');
  assert.deepEqual(before.payload, after.payload);
  assert.deepEqual({ ...before.variables, priceText: after.variables.priceText }, after.variables);
});
test('redesign keeps exactly the same supplied values', () => {
  assert.deepEqual(buildRequest(product, a).variables, buildRequest(product, b).variables);
  assert.notEqual(a.backgroundColor, b.backgroundColor);
  assert.notDeepEqual(a.visuals, b.visuals);
});
test('currency-formatted strings are rejected instead of coerced', () => {
  assert.throws(() => toTemplateValues(readJson('data/product-invalid.json')), /priceCents must be integer/);
  assert.throws(() => toTemplateValues({ ...product, priceCents: '2100' }), /must be integer/);
});
test('currency, price bounds, required fields and unexpected properties are app rules', () => {
  for (const input of [{ ...product, currency:'EUR' }, { ...product, priceCents:-1 }, { ...product, priceCents:99901 }, { ...product, priceCents:21.5 }, { ...product, name:undefined }, { ...product, color:'#fff' }]) assert.throws(() => validateProduct(input), /Invalid product/);
});
test('zero and cent values format without losing cents', () => {
  assert.equal(toTemplateValues({ ...product, priceCents:0 }).priceText,'$0.00');
  assert.equal(toTemplateValues({ ...product, priceCents:2199 }).priceText,'$21.99');
});
test('invalid media addresses and blank or unsafe names are rejected', () => {
  for (const input of [{ ...product, imageUrl:'not-a-url' }, { ...product, imageUrl:'http://example.com/photo.png' }, { ...product, name:' ' }, { ...product, name:'<b>cream</b>' }, { ...product, name:'{{priceText}}' }, { ...product, name:'x'.repeat(41) }]) assert.throws(() => validateProduct(input));
});
test('renamed variable with valid fallback is caught before submission', () => {
  assert.throws(() => buildRequest(sale, readJson('templates/broken-rename.json')), /Template contract changed/);
});
test('removing the price is caught even if the remaining design is valid', () => {
  assert.throws(() => assertTemplateContract(readJson('templates/broken-removal.json')), /Template contract changed/);
  const unused = structuredClone(a);unused.visuals = unused.visuals.filter(v => v.text !== '{{priceText}}');
  assert.throws(() => assertTemplateContract(unused), /consumed/);
});
test('mapping is explicit and does not mutate the store record', () => {
  const copy = structuredClone(product);
  assert.deepEqual(Object.keys(toTemplateValues(product)).sort(), ['priceText','productImage','productName']);
  assert.deepEqual(product, copy);
});
