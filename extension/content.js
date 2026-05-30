(function () {
  'use strict';

  const STATE_KEY = '__CHATGPT_CODE_WRAP_STATE__';
  const ATTR = 'data-ai-wrap';
  const PROCESSED = 'data-ai-wrap-init';
  const STYLE_ID = 'ai-code-wrap-style';
  const DEFAULT_WRAP_KEY = 'defaultWrap';

  let defaultWrap = 'off';

  const previousState = window[STATE_KEY];

  if (previousState && previousState.observer) {
    previousState.observer.disconnect();
  }

  if (previousState && Array.isArray(previousState.timers)) {
    previousState.timers.forEach((timer) => window.clearTimeout(timer));
  }

  if (
    previousState &&
    previousState.storageListener &&
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.onChanged
  ) {
    chrome.storage.onChanged.removeListener(previousState.storageListener);
  }

  if (previousState && previousState.scanFrame) {
    window.cancelAnimationFrame(previousState.scanFrame);
  }

  const manualWrapOverrides =
    previousState && previousState.manualWrapOverrides instanceof Map
      ? previousState.manualWrapOverrides
      : new Map();

  const state = {
    observer: null,
    timers: [],
    storageListener: null,
    scanFrame: null,
    manualWrapOverrides,
  };

  window[STATE_KEY] = state;

  function injectStyle() {
    let style = document.getElementById(STYLE_ID);

    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      [${ATTR}="on"] {
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        overflow-x: visible !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }

      [${ATTR}="on"] pre,
      [${ATTR}="on"] code,
      [${ATTR}="on"] .cm-content,
      [${ATTR}="on"] .cm-line,
      [${ATTR}="on"] .cm-scroller,
      [${ATTR}="on"] [class*="cm-content"],
      [${ATTR}="on"] [class*="cm-line"],
      [${ATTR}="on"] [class*="cm-scroller"] {
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        overflow-x: visible !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }

      [${ATTR}="on"] .\\!whitespace-pre,
      [${ATTR}="on"] [class*="whitespace-pre"] {
        white-space: pre-wrap !important;
      }

      html[data-ai-wrap-default="on"] [role="group"]:not([${ATTR}="off"]) pre.code-block__code {
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        overflow-x: visible !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }

      html[data-ai-wrap-default="on"] pre.code-block__code:not([${PROCESSED}]) {
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        overflow-x: visible !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }

      [${ATTR}="on"] [class*="overflow-x"],
      [${ATTR}="on"] [class*="overflow-y-auto"],
      [${ATTR}="on"] [class*="overflow-auto"],
      [${ATTR}="on"] [dir="ltr"] {
        overflow-x: visible !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }

      .ai-wrap-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 2px 10px 2px 6px;
        border: none;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
        font-family: inherit;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
        pointer-events: auto !important;
        transition: filter 0.2s ease, background 0.2s ease, color 0.2s ease;
      }

      .ai-wrap-toggle:hover {
        filter: brightness(0.92);
      }

      .ai-wrap-toggle:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }

      .ai-wrap-fallback-root {
        position: relative !important;
        padding-top: 26px !important;
      }

      .ai-wrap-toggle.ai-wrap-floating {
        position: absolute;
        top: 5px;
        right: 43px;
        z-index: 9999;
        box-shadow: -6px 0 6px var(--bg-primary, #f7f7f8);
        opacity: 1;
        pointer-events: auto !important;
      }

      .ai-wrap-toggle.ai-wrap-claude {
        position: absolute;
        top: 12px;
        right: 44px;
        z-index: 9999;
        opacity: 1;
        pointer-events: auto !important;
      }

      .ai-wrap-toggle.ai-wrap-gemini {
        margin-right: 8px;
        opacity: 1;
        pointer-events: auto !important;
        position: relative;
        top: -5px;
      }

      .ai-wrap-toggle.ai-wrap-gemini-floating {
        position: absolute;
        top: 8px;
        right: 44px;
        z-index: 9999;
      }

      .ai-pill-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        transition: background 0.2s ease;
      }

      .ai-pill-on {
        background: rgba(16, 163, 127, 0.15);
        color: #10a37f;
      }

      .ai-pill-on .ai-pill-dot {
        background: #10a37f;
      }

      .ai-pill-off {
        background: rgba(150, 150, 150, 0.15);
        color: #888;
      }

      .ai-pill-off .ai-pill-dot {
        background: #888;
      }
    `;
  }

  function resetInjectedDom() {
    document.querySelectorAll('.ai-wrap-toggle').forEach((button) => {
      button.remove();
    });

    document.querySelectorAll('[' + PROCESSED + ']').forEach((element) => {
      element.removeAttribute(PROCESSED);
    });

    document.querySelectorAll('.ai-wrap-fallback-root').forEach((element) => {
      element.classList.remove('ai-wrap-fallback-root');
    });

    // Keep data-ai-wrap="on/off" on roots; startup reconciles those roots
    // with the stored default after buttons are repaired.
  }

  function canUseSyncStorage() {
    return (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.sync
    );
  }

  function canListenToStorageChanges() {
    return (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.onChanged
    );
  }

  function toWrapState(isEnabled) {
    return isEnabled ? 'on' : 'off';
  }

  function syncDefaultWrapAttribute() {
    if (defaultWrap === 'on') {
      document.documentElement.setAttribute('data-ai-wrap-default', 'on');
      return;
    }

    document.documentElement.removeAttribute('data-ai-wrap-default');
  }

  function loadDefaultWrap(callback) {
    if (!canUseSyncStorage()) {
      callback(false);
      return;
    }

    chrome.storage.sync.get({ [DEFAULT_WRAP_KEY]: false }, (settings) => {
      if (chrome.runtime.lastError) {
        callback(false);
        return;
      }

      callback(Boolean(settings[DEFAULT_WRAP_KEY]));
    });
  }

  function updateButtonState(button, root) {
    const isOn = root.getAttribute(ATTR) === 'on';

    button.classList.toggle('ai-pill-on', isOn);
    button.classList.toggle('ai-pill-off', !isOn);

    button.setAttribute('title', isOn ? 'Disable code wrap' : 'Enable code wrap');
    button.setAttribute(
      'aria-label',
      isOn ? 'Disable code wrap for this code block' : 'Enable code wrap for this code block'
    );
  }

  function updateButtonsForRoot(root) {
    root.querySelectorAll('.ai-wrap-toggle').forEach((button) => {
      updateButtonState(button, root);
    });
  }

  function setWrapState(root, wrapState) {
    root.setAttribute(ATTR, wrapState);
    updateButtonsForRoot(root);
  }

  function applyDefaultWrapToExistingBlocks() {
    document.querySelectorAll('[' + ATTR + ']').forEach((root) => {
      setWrapState(root, defaultWrap);
    });
  }

  function getCodeText(element) {
    const codeElement =
      element.matches && element.matches('pre:not(.cm-content)')
        ? element
        : element.querySelector('pre:not(.cm-content)');

    return ((codeElement && (codeElement.innerText || codeElement.textContent)) || '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function getBlockSignature(element) {
    const text = getCodeText(element);

    if (!text) return '';

    return text.slice(0, 4000);
  }

  function rememberManualOverride(element, wrapState) {
    const signature = getBlockSignature(element);

    if (!signature) return;

    manualWrapOverrides.set(signature, wrapState);

    if (manualWrapOverrides.size > 200) {
      manualWrapOverrides.delete(manualWrapOverrides.keys().next().value);
    }
  }

  function getManualOverride(element) {
    const signature = getBlockSignature(element);

    if (!signature) return null;

    return manualWrapOverrides.get(signature) || null;
  }

  function toggleWrap(root, sourceElement) {
    const isOn = root.getAttribute(ATTR) === 'on';
    const nextState = isOn ? 'off' : 'on';

    setWrapState(root, nextState);
    rememberManualOverride(sourceElement || root, nextState);
  }

  function createBtn(root, sourceElement) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ai-wrap-toggle';

    const dot = document.createElement('span');
    dot.className = 'ai-pill-dot';

    const label = document.createElement('span');
    label.textContent = 'Wrap';

    button.appendChild(dot);
    button.appendChild(label);

    if (!root.hasAttribute(ATTR)) {
      root.setAttribute(ATTR, getManualOverride(sourceElement || root) || defaultWrap);
    }

    updateButtonState(button, root);

    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    button.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleWrap(root, sourceElement || root);
    });

    return button;
  }

  function shouldSkipEverywhere(pre) {
    if (!pre || !(pre instanceof Element)) return true;

    // Skip editor / input areas on all supported sites.
    if (pre.closest('[contenteditable], textarea, [role="textbox"]')) return true;

    // General nested-pre guard.
    // If this <pre> is inside another <pre>, process only the outer block.
    if (pre.parentElement && pre.parentElement.closest('pre')) return true;

    return false;
  }

  function shouldSkipChatGPTPre(pre) {
    // Skip ChatGPT user messages.
    if (pre.closest('[data-message-author-role="user"]')) return true;

    // New ChatGPT structure:
    // outer <pre> contains inner <pre class="cm-content">.
    // The inner one is CodeMirror content, not a code-block container.
    if (pre.classList.contains('cm-content')) return true;

    return false;
  }

  function shouldSkipClaudePre(pre) {
    // Skip Claude user message code blocks.
    return Boolean(
      pre.closest('[data-testid="user-message"]') ||
      pre.closest('[data-user-message-bubble="true"]') ||
      pre.closest('[class*="font-user-message"]')
    );
  }

  function isCopyButton(button) {
    const text = (button.innerText || button.textContent || '').trim().toLowerCase();
    const aria = (button.getAttribute('aria-label') || '').toLowerCase();
    const title = (button.getAttribute('title') || '').toLowerCase();

    return (
      text.includes('copy') ||
      aria.includes('copy') ||
      title.includes('copy') ||
      text.includes('复制') ||
      aria.includes('复制') ||
      title.includes('复制')
    );
  }

  function groupLooksLikeRealHeader(group) {
    const stickyAncestor = group.closest('[class*="sticky"]');
    const justifyBetweenAncestor = group.closest('[class*="justify-between"]');

    return Boolean(stickyAncestor || justifyBetweenAncestor);
  }

  function findHeaderButtonGroup(pre) {
    const groups = Array.from(
      pre.querySelectorAll('[class*="flex-row"][class*="items-center"][class*="gap"]')
    );

    return groups.find((group) => {
      if (!groupLooksLikeRealHeader(group)) return false;

      const buttons = Array.from(group.querySelectorAll('button, [role="button"]'));
      return buttons.some(isCopyButton);
    }) || null;
  }

  function hasCodeText(pre) {
    return Boolean((pre.innerText || pre.textContent || '').trim());
  }

  function ensureRelativePosition(element) {
    const position = window.getComputedStyle(element).position;

    if (position === 'static') {
      element.style.position = 'relative';
    }
  }

  function makeFloatingButton(button) {
    button.classList.add('ai-wrap-floating');
  }

  function isClaudeCodePre(pre) {
    return pre.matches('pre.code-block__code');
  }

  function findClaudeCodeRoot(pre) {
    return (
      pre.closest('[role="group"][aria-label*="code"]') ||
      pre.closest('[role="group"]') ||
      pre.parentElement
    );
  }

  function isGeminiCodePre(pre) {
    return Boolean(
      pre.closest('code-block, .code-block') &&
      (
        pre.closest('response-element') ||
        pre.closest('message-content') ||
        pre.closest('.model-response-text') ||
        pre.closest('structured-content-container')
      )
    );
  }

  function findGeminiCodeRoot(pre) {
    const codeBlockElement = pre.closest('code-block');
    if (codeBlockElement) return codeBlockElement;

    const classRoot = pre.closest('.code-block');

    if (classRoot && classRoot.querySelectorAll('pre:not(.cm-content)').length === 1) {
      return classRoot;
    }

    return pre.parentElement;
  }

  function findGeminiButtonHost(root) {
    return (
      root.querySelector('.code-block-decoration .buttons') ||
      root.querySelector('.buttons')
    );
  }

  function getProcessedRoot(pre) {
    if (isClaudeCodePre(pre)) {
      return findClaudeCodeRoot(pre) || pre;
    }

    if (isGeminiCodePre(pre)) {
      return findGeminiCodeRoot(pre) || pre;
    }

    return pre;
  }

  function needsRepair(pre) {
    const root = getProcessedRoot(pre);

    if (!root) return false;

    const processed = pre.hasAttribute(PROCESSED) || root.hasAttribute(PROCESSED);
    if (!processed) return false;

    return !root.querySelector('.ai-wrap-toggle');
  }

  function findDirectFloatingButton(pre) {
    return Array.from(pre.children).find((child) => (
      child.classList &&
      child.classList.contains('ai-wrap-toggle') &&
      child.classList.contains('ai-wrap-floating')
    )) || null;
  }

  function repairChatGPTHeaderPlacement(pre) {
    if (!pre.hasAttribute(PROCESSED)) return false;
    if (isClaudeCodePre(pre) || isGeminiCodePre(pre)) return false;
    if (shouldSkipEverywhere(pre) || shouldSkipChatGPTPre(pre)) return false;

    const button = findDirectFloatingButton(pre);
    if (!button) return false;

    const buttonGroup = findHeaderButtonGroup(pre);
    if (!buttonGroup) return false;

    button.classList.remove('ai-wrap-floating');
    pre.classList.remove('ai-wrap-fallback-root');
    buttonGroup.insertBefore(button, buttonGroup.firstChild);
    updateButtonState(button, pre);

    return true;
  }

  function clearProcessedFlags(pre) {
    const root = getProcessedRoot(pre);

    pre.removeAttribute(PROCESSED);

    if (root && root !== pre) {
      root.removeAttribute(PROCESSED);
    }
  }

  function processClaudeBlock(pre) {
    const root = findClaudeCodeRoot(pre);

    if (!root || root.hasAttribute(PROCESSED)) return;

    root.setAttribute(PROCESSED, '1');
    pre.setAttribute(PROCESSED, '1');

    const button = createBtn(root, pre);
    button.classList.add('ai-wrap-claude');

    ensureRelativePosition(root);
    root.insertBefore(button, root.firstChild);
  }

  function processGeminiBlock(pre) {
    const root = findGeminiCodeRoot(pre);

    if (!root || root.hasAttribute(PROCESSED)) return;

    root.setAttribute(PROCESSED, '1');
    pre.setAttribute(PROCESSED, '1');

    const button = createBtn(root, pre);
    button.classList.add('ai-wrap-gemini');

    const host = findGeminiButtonHost(root);

    if (host) {
      host.insertBefore(button, host.firstChild);
      return;
    }

    ensureRelativePosition(root);
    button.classList.add('ai-wrap-gemini-floating');
    root.insertBefore(button, root.firstChild);
  }

  function processBlock(pre) {
    // Universal guard for all supported sites.
    if (shouldSkipEverywhere(pre)) return;

    if (isClaudeCodePre(pre)) {
      if (shouldSkipClaudePre(pre)) return;
      processClaudeBlock(pre);
      return;
    }

    if (isGeminiCodePre(pre)) {
      processGeminiBlock(pre);
      return;
    }

    // ChatGPT-specific guard.
    if (shouldSkipChatGPTPre(pre)) return;

    if (pre.hasAttribute(PROCESSED)) return;

    // Main path:
    // ChatGPT code blocks with a real header, e.g. language + copy/run buttons.
    const buttonGroup = findHeaderButtonGroup(pre);

    // ChatGPT can create an empty placeholder <pre> while a response starts.
    // Wait until either the header or real code text exists before adding UI.
    if (!buttonGroup && !hasCodeText(pre)) return;

    pre.setAttribute(PROCESSED, '1');

    const button = createBtn(pre, pre);

    if (buttonGroup) {
      buttonGroup.insertBefore(button, buttonGroup.firstChild);
      return;
    }

    // Fallback:
    // Plain text code blocks without a real header.
    // Add modest top padding so the floating Wrap button does not cover the first line.
    ensureRelativePosition(pre);
    pre.classList.add('ai-wrap-fallback-root');
    makeFloatingButton(button);
    pre.insertBefore(button, pre.firstChild);
  }

  function scan() {
    document
      .querySelectorAll('pre:not(.cm-content)')
      .forEach((pre) => {
        if (needsRepair(pre)) {
          clearProcessedFlags(pre);
          processBlock(pre);
          return;
        }

        if (repairChatGPTHeaderPlacement(pre)) {
          return;
        }

        const root = getProcessedRoot(pre);

        if (pre.hasAttribute(PROCESSED) || (root && root.hasAttribute(PROCESSED))) {
          return;
        }

        processBlock(pre);
      });
  }

  function throttledScan() {
    if (state.scanFrame) return;

    state.scanFrame = window.requestAnimationFrame(() => {
      state.scanFrame = null;
      scan();
    });
  }

  function setManagedTimeout(callback, delay) {
    const timer = window.setTimeout(callback, delay);
    state.timers.push(timer);
    return timer;
  }

  function listenForDefaultWrapChanges() {
    if (!canListenToStorageChanges()) return;

    const listener = (changes, areaName) => {
      if (areaName !== 'sync' || !changes[DEFAULT_WRAP_KEY]) return;

      defaultWrap = toWrapState(Boolean(changes[DEFAULT_WRAP_KEY].newValue));
      syncDefaultWrapAttribute();
      applyDefaultWrapToExistingBlocks();
      scan();
    };

    chrome.storage.onChanged.addListener(listener);
    state.storageListener = listener;
  }

  function start() {
    loadDefaultWrap((isEnabled) => {
      defaultWrap = toWrapState(isEnabled);
      syncDefaultWrapAttribute();

      injectStyle();
      resetInjectedDom();
      scan();
      applyDefaultWrapToExistingBlocks();

      state.observer = new MutationObserver(throttledScan);

      state.observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'title', 'aria-label'],
      });

      listenForDefaultWrapChanges();
      setManagedTimeout(scan, 1000);
      setManagedTimeout(scan, 3000);
    });
  }

  if (document.body) {
    start();
  } else {
    window.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
