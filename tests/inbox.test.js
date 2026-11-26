const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const INBOX_KEY = 'taskManager.inbox.v1';

function load(items) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    runScripts: 'outside-only',
    url: 'http://localhost/',
  });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.localStorage.setItem(INBOX_KEY, JSON.stringify(items));
  window.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
  return window;
}

const seed = () => [
  { id: 1, text: 'first', read: false },
  { id: 2, text: 'second', read: false },
  { id: 3, text: 'third', read: true },
];
const count = (w) => w.document.querySelector('#inboxCount').textContent;
const badges = (w) => w.document.querySelectorAll('#inboxList .unread').length;
const textOf = (w, n) => w.document.querySelectorAll('#inboxList li')[n].querySelector('span');
const stored = (w) => JSON.parse(w.localStorage.getItem(INBOX_KEY));

test('click on unread item removes badge and updates count', () => {
  const w = load(seed());
  assert.equal(count(w), '2');
  textOf(w, 0).click();
  assert.equal(count(w), '1');
  assert.equal(badges(w), 1);
  assert.equal(stored(w)[0].read, true);
});

test('Enter and Space mark the item read', () => {
  const w = load(seed());
  textOf(w, 0).dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(count(w), '1');
  const space = new w.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  textOf(w, 1).dispatchEvent(space);
  assert.equal(space.defaultPrevented, true);
  assert.equal(count(w), '0');
  assert.equal(badges(w), 0);
});

test('Triage marks the item read', () => {
  const w = load(seed());
  w.document.querySelectorAll('#inboxList li')[0].querySelector('button').click();
  assert.equal(count(w), '1');
  assert.equal(badges(w), 1);
  assert.equal(w.document.querySelector('#formDlg').open, true);
});

test('clicking an already-read item changes nothing', () => {
  const w = load(seed());
  const before = w.localStorage.getItem(INBOX_KEY);
  const html = w.document.querySelector('#inboxList').innerHTML;
  textOf(w, 2).click();
  assert.equal(w.localStorage.getItem(INBOX_KEY), before);
  assert.equal(w.document.querySelector('#inboxList').innerHTML, html);
  assert.equal(count(w), '2');
});
