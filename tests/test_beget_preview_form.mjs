import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('dist/beget-preview/index.html', 'utf8');
let submit;
let requests = 0;
const nodes = new Map();
function element(id) {
  if (!nodes.has(id)) nodes.set(id, {
    value: id === '#priceMode' ? 'discuss' : '',
    disabled: id === 'send',
    querySelector: element,
    addEventListener(type, fn) { if (type === 'submit') submit = fn; },
  });
  return nodes.get(id);
}
const context = {
  // Simulate an unwanted earlier config: the prepared preview must override it.
  window: { OPYLITEL_INTAKE: { enabled: true, legalDocumentsApproved: true } },
  document: { getElementById: element },
  fetch() { requests++; throw Error('unexpected network request'); },
};
vm.createContext(context);
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  new vm.Script(match[1]).runInContext(context);
}
assert.equal(context.window.OPYLITEL_INTAKE.enabled, false);
assert.equal(context.window.OPYLITEL_INTAKE.legalDocumentsApproved, false);
assert.equal(element('send').disabled, true);
assert.equal(typeof submit, 'function');
await submit({ preventDefault() {} });
assert.equal(requests, 0);
console.log('PASS: preview stays closed even with an earlier active window config.');
