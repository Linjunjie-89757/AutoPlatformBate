const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea']);
const INTERACTIVE_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'menuitem',
  'radio',
  'searchbox',
  'switch',
  'tab',
  'textbox',
]);

const LOGIN_HINTS = [
  'login',
  'signin',
  'sign-in',
  'auth',
  'sso',
  '登录',
  '登陆',
  '认证',
  '账号',
  '密码',
  '验证码',
];

export function buildCandidatesFromElements(elements) {
  return elements
    .filter((element) => element.visible)
    .filter(isUsefulElement)
    .map((element, index) => {
      const locator = buildLocator(element);
      const framePath = normalizePathMetadata(element.framePath);
      const shadowPath = normalizePathMetadata(element.shadowPath);
      return {
        tempId: `candidate-${index + 1}`,
        name: inferElementName(element, index),
        elementType: inferElementType(element),
        regionName: trimText(element.regionName),
        regionType: trimText(element.regionType),
        locator: {
          ...locator,
          framePath,
          shadowPath,
        },
        framePath,
        shadowPath,
        text: trimText(element.text),
        placeholder: trimText(element.placeholder),
        tagName: String(element.tagName || '').toLowerCase(),
        attributes: {
          id: trimText(element.id),
          name: trimText(element.name),
          testId: trimText(element.testId),
          role: trimText(element.role),
          ariaLabel: trimText(element.ariaLabel),
          href: trimText(element.href),
          type: trimText(element.type),
        },
        stabilityScore: scoreLocator(locator.strategy),
        source: 'RULE',
      };
    });
}

export function isProbablyLoginPage(pageInfo) {
  const haystack = [
    pageInfo.url,
    pageInfo.title,
    pageInfo.visibleText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (pageInfo.hasPasswordInput) {
    return true;
  }

  return LOGIN_HINTS.some((hint) => haystack.includes(hint.toLowerCase()));
}

export function normalizeLocatorValidationResult(result) {
  const matchCount = Number(result.matchCount || 0);
  const validationStatus = matchCount === 1 ? 'PASSED' : matchCount > 1 ? 'MULTIPLE' : 'FAILED';
  const validationMessage = validationStatus === 'PASSED'
    ? '本地页面验证通过'
    : validationStatus === 'MULTIPLE'
      ? `定位器匹配到 ${matchCount} 个元素，建议人工确认唯一性`
      : '本地页面验证未找到元素';
  const framePath = normalizePathMetadata(result.framePath);
  const shadowPath = normalizePathMetadata(result.shadowPath);

  return {
    locatorType: result.locatorType,
    locatorValue: result.locatorValue,
    ...(framePath.length > 0 ? { framePath } : {}),
    ...(shadowPath.length > 0 ? { shadowPath } : {}),
    validationStatus,
    matchCount,
    visible: Boolean(result.visible),
    enabled: Boolean(result.enabled),
    editable: Boolean(result.editable),
    clickable: Boolean(result.enabled),
    inputtable: Boolean(result.editable),
    validationMessage,
    screenshotBase64: result.screenshotBase64 || null,
  };
}

function normalizePathMetadata(value) {
  return Array.isArray(value) ? value : [];
}

function isUsefulElement(element) {
  const tagName = String(element.tagName || '').toLowerCase();
  const role = String(element.role || '').toLowerCase();
  const hasStableAttribute = Boolean(element.testId || element.id || element.name || element.ariaLabel);
  const hasHumanText = Boolean(element.text || element.placeholder || element.label);

  return INTERACTIVE_TAGS.has(tagName)
    || INTERACTIVE_ROLES.has(role)
    || hasStableAttribute
    || (tagName === 'option' && hasHumanText);
}

function buildLocator(element) {
  const alternatives = [];
  const primary = firstLocator([
    locator('TEST_ID', element.testId),
    locator('LABEL', element.label),
    locator('ROLE', buildRoleLocatorValue(element)),
    locator('TEXT', element.text),
    locator('CSS', element.id ? `#${cssEscape(element.id)}` : ''),
    locator('CSS', element.name ? `[name="${cssAttributeEscape(element.name)}"]` : ''),
    locator('CSS', element.cssPath),
    locator('XPATH', element.xpath),
  ]);

  const seen = new Set([`${primary.strategy}:${primary.value}`]);

  for (const option of [
    locator('LABEL', element.label),
    locator('ROLE', buildRoleLocatorValue(element)),
    locator('TEXT', element.text),
    locator('CSS', element.id ? `#${cssEscape(element.id)}` : ''),
    locator('CSS', element.name ? `[name="${cssAttributeEscape(element.name)}"]` : ''),
    locator('CSS', element.cssPath),
    locator('XPATH', element.xpath),
  ]) {
    const key = option ? `${option.strategy}:${option.value}` : '';
    if (option && !seen.has(key)) {
      alternatives.push(option);
      seen.add(key);
    }
  }

  return {
    ...primary,
    alternatives,
  };
}

function firstLocator(options) {
  return options.find(Boolean) || locator('CSS', 'body');
}

function locator(strategy, value) {
  const normalized = trimText(value);
  return normalized ? { strategy, value: normalized } : null;
}

function buildRoleLocatorValue(element) {
  const role = trimText(element.role);
  if (!role) {
    return '';
  }

  const name = trimText(element.ariaLabel || element.text || element.placeholder || element.label);
  return name ? `${role}[name="${name}"]` : role;
}

function inferElementName(element, index) {
  return trimText(
    element.label
      || element.ariaLabel
      || element.placeholder
      || element.text
      || element.name
      || element.id
      || element.testId
      || `页面元素 ${index + 1}`,
  );
}

function inferElementType(element) {
  const tagName = String(element.tagName || '').toLowerCase();
  const type = String(element.type || '').toLowerCase();
  const role = String(element.role || '').toLowerCase();

  if (tagName === 'input' && ['button', 'submit', 'reset'].includes(type)) {
    return 'BUTTON';
  }
  if (tagName === 'input' || tagName === 'textarea' || role === 'textbox' || role === 'searchbox') {
    return 'INPUT';
  }
  if (tagName === 'select' || role === 'combobox') {
    return 'SELECT';
  }
  if (tagName === 'button' || role === 'button') {
    return 'BUTTON';
  }
  if (tagName === 'a' || role === 'link') {
    return 'LINK';
  }
  return 'OTHER';
}

function scoreLocator(strategy) {
  switch (strategy) {
    case 'TEST_ID':
      return 96;
    case 'LABEL':
      return 90;
    case 'ROLE':
      return 86;
    case 'CSS':
      return 78;
    case 'TEXT':
      return 72;
    case 'XPATH':
      return 62;
    default:
      return 50;
  }
}

function trimText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cssEscape(value) {
  return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function cssAttributeEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
