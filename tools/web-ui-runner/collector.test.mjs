import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCandidatesFromElements, normalizeLocatorValidationResult, isProbablyLoginPage } from './collector.mjs';

test('buildCandidatesFromElements keeps useful visible controls and ranks stable locators first', () => {
  const candidates = buildCandidatesFromElements([
    {
      tagName: 'input',
      type: 'text',
      visible: true,
      text: '',
      placeholder: 'Username',
      ariaLabel: '',
      name: 'username',
      id: '',
      testId: 'login-username',
      href: '',
      role: '',
      label: 'Username',
      cssPath: 'body > input:nth-child(1)',
      xpath: '//input[1]',
    },
    {
      tagName: 'div',
      type: '',
      visible: true,
      text: 'Static text',
      placeholder: '',
      ariaLabel: '',
      name: '',
      id: '',
      testId: '',
      href: '',
      role: '',
      label: '',
      cssPath: 'body > div:nth-child(2)',
      xpath: '//div[1]',
    },
    {
      tagName: 'button',
      type: 'button',
      visible: false,
      text: 'Hidden button',
      placeholder: '',
      ariaLabel: '',
      name: '',
      id: 'hidden-action',
      testId: '',
      href: '',
      role: '',
      label: '',
      cssPath: '#hidden-action',
      xpath: '//*[@id="hidden-action"]',
    },
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, 'Username');
  assert.equal(candidates[0].locator.strategy, 'TEST_ID');
  assert.equal(candidates[0].locator.value, 'login-username');
  assert.equal(candidates[0].locator.alternatives[0].strategy, 'LABEL');
  assert.equal(candidates[0].elementType, 'INPUT');
});

test('isProbablyLoginPage detects common login hints from url and page fields', () => {
  assert.equal(
    isProbablyLoginPage({
      url: 'https://example.test/auth/login',
      title: 'Login',
      hasPasswordInput: false,
      visibleText: 'Welcome',
    }),
    true,
  );

  assert.equal(
    isProbablyLoginPage({
      url: 'https://example.test/orders',
      title: 'Orders',
      hasPasswordInput: true,
      visibleText: 'Account Password Login',
    }),
    true,
  );

  assert.equal(
    isProbablyLoginPage({
      url: 'https://example.test/orders',
      title: 'Orders',
      hasPasswordInput: false,
      visibleText: 'Create Order Search Export',
    }),
    false,
  );
});

test('buildCandidatesFromElements removes duplicate alternative locators', () => {
  const [candidate] = buildCandidatesFromElements([
    {
      tagName: 'input',
      type: 'text',
      visible: true,
      text: '',
      placeholder: '',
      ariaLabel: '',
      name: '',
      id: 'username',
      testId: 'login-username',
      href: '',
      role: '',
      label: '',
      cssPath: '#username',
      xpath: '//*[@id="username"]',
    },
  ]);

  const cssAlternatives = candidate.locator.alternatives.filter((item) => item.strategy === 'CSS');

  assert.deepEqual(
    cssAlternatives.map((item) => item.value),
    ['#username'],
  );
});

test('buildCandidatesFromElements preserves frame and shadow context metadata', () => {
  const [candidate] = buildCandidatesFromElements([
    {
      tagName: 'button',
      visible: true,
      text: 'Save',
      placeholder: '',
      ariaLabel: '',
      name: '',
      id: '',
      testId: 'save',
      href: '',
      role: '',
      label: '',
      cssPath: 'button',
      xpath: '//button',
      framePath: [{ selector: 'iframe#child', url: 'https://example.test/frame' }],
      shadowPath: ['custom-shell'],
    },
  ]);

  assert.deepEqual(candidate.framePath, [{ selector: 'iframe#child', url: 'https://example.test/frame' }]);
  assert.deepEqual(candidate.shadowPath, ['custom-shell']);
  assert.deepEqual(candidate.locator.framePath, [{ selector: 'iframe#child', url: 'https://example.test/frame' }]);
  assert.deepEqual(candidate.locator.shadowPath, ['custom-shell']);
});

test('normalizeLocatorValidationResult maps match counts to validation statuses', () => {
  assert.deepEqual(
    normalizeLocatorValidationResult({
      locatorType: 'CSS',
      locatorValue: '#submit',
      matchCount: 1,
      visible: true,
      editable: false,
      enabled: true,
      screenshotBase64: 'png',
    }),
    {
      locatorType: 'CSS',
      locatorValue: '#submit',
      validationStatus: 'PASSED',
      matchCount: 1,
      visible: true,
      enabled: true,
      editable: false,
      clickable: true,
      inputtable: false,
      validationMessage: '本地页面验证通过',
      screenshotBase64: 'png',
    },
  );

  assert.equal(normalizeLocatorValidationResult({ locatorType: 'CSS', locatorValue: '.row', matchCount: 2 }).validationStatus, 'MULTIPLE');
  assert.equal(normalizeLocatorValidationResult({ locatorType: 'CSS', locatorValue: '#missing', matchCount: 0 }).validationStatus, 'FAILED');
});

test('normalizeLocatorValidationResult preserves locator context metadata', () => {
  const result = normalizeLocatorValidationResult({
    locatorType: 'CSS',
    locatorValue: '#submit',
    framePath: [{ selector: 'iframe#child' }],
    shadowPath: ['custom-shell'],
    matchCount: 1,
    visible: true,
    enabled: true,
  });

  assert.deepEqual(result.framePath, [{ selector: 'iframe#child' }]);
  assert.deepEqual(result.shadowPath, ['custom-shell']);
});
