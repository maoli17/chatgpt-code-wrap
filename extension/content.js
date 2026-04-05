(function () {
  'use strict';

  const ATTR = 'data-ai-wrap';
  const PROCESSED = 'data-ai-wrap-init';

  const style = document.createElement('style');
  style.id = 'ai-code-wrap-style';
  style.textContent = `
    /* === CodeMirror code blocks === */
    pre[${ATTR}="on"] .cm-content,
    pre[${ATTR}="on"] .cm-line {
      white-space: pre-wrap !important;
      overflow-wrap: anywhere !important;
      min-width: 0 !important;
    }

    /* === Traditional <pre><code> blocks === */
    pre[${ATTR}="on"] code {
      white-space: pre-wrap !important;
      overflow-wrap: anywhere !important;
      min-width: 0 !important;
    }

    /* === Simple code blocks (plain <pre> with <span>) === */
    pre[${ATTR}="on"],
    pre[${ATTR}="on"] > span,
    pre[${ATTR}="on"] > div {
      white-space: pre-wrap !important;
      overflow-wrap: anywhere !important;
      min-width: 0 !important;
      max-width: 100% !important;
    }

    /* Only override overflow when wrap is active */
    pre[${ATTR}="on"] [class*="overflow-x"] {
      overflow-x: visible !important;
    }

    /* === Pill toggle button === */
    .ai-wrap-toggle {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 10px 2px 6px;
      border: none;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      line-height: 20px;
      font-family: inherit;
      white-space: nowrap;
    }
    .ai-pill-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
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
      color: #999;
    }
    .ai-pill-off .ai-pill-dot {
      background: #999;
    }
    .ai-wrap-toggle:hover {
      filter: brightness(0.9);
    }
  `;
  document.head.appendChild(style);

  function createBtn(pre) {
    const btn = document.createElement('button');
    btn.className = 'ai-wrap-toggle';
    btn.title = 'Toggle word wrap';

    const dot = document.createElement('span');
    dot.className = 'ai-pill-dot';
    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(' Wrap'));

    function update() {
      const isOn = pre.getAttribute(ATTR) === 'on';
      btn.classList.toggle('ai-pill-on', isOn);
      btn.classList.toggle('ai-pill-off', !isOn);
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOn = pre.getAttribute(ATTR) === 'on';
      pre.setAttribute(ATTR, isOn ? 'off' : 'on');
      update();
    });

    pre.setAttribute(ATTR, 'off');
    update();
    return btn;
  }

  function processBlock(pre) {
    if (pre.hasAttribute(PROCESSED)) return;
    pre.setAttribute(PROCESSED, '1');

    // Strategy 1: Header button bar (code blocks with language label)
    // NOTE: These selectors match Tailwind CSS class fragments used by ChatGPT.
    // ChatGPT frequently updates its DOM/class names — if buttons stop appearing
    // in the header bar, these selectors likely need updating. Check the <pre>
    // element's inner structure with DevTools to find the new class names.
    const btnGroup = pre.querySelector(
      '[class*="flex-row"][class*="items-center"][class*="gap"]'
    );
    if (btnGroup) {
      btnGroup.insertBefore(createBtn(pre), btnGroup.firstChild);
      return;
    }

    // Strategy 2: Scroll container (simple code blocks without header)
    const scrollParent = pre.querySelector('[class*="overflow-x-hidden"]')
      || pre.querySelector('[class*="overflow-y-auto"]');
    if (scrollParent) {
      scrollParent.style.position = 'relative';
      const btn = createBtn(pre);
      Object.assign(btn.style, {
        position: 'absolute',
        top: '8px',
        right: '43px',
        zIndex: '20',
        background: 'var(--bg-primary, #f7f7f8)',
        boxShadow: '-6px 0 6px var(--bg-primary, #f7f7f8)',
        opacity: '0.7',
      });
      scrollParent.insertBefore(btn, scrollParent.firstChild);
      return;
    }

    // Strategy 3: Fallback — position button inside pre
    // NOTE: We no longer set pre.style.overflow = 'visible' here to avoid
    // breaking parent container layout. The button may be clipped in rare
    // cases, but layout integrity is more important.
    pre.style.position = 'relative';
    const btn = createBtn(pre);
    Object.assign(btn.style, {
      position: 'absolute',
      top: '8px',
      right: '43px',
      zIndex: '20',
      background: 'var(--bg-primary, #f7f7f8)',
      boxShadow: '-6px 0 6px var(--bg-primary, #f7f7f8)',
      opacity: '0.7',
    });
    pre.insertBefore(btn, pre.firstChild);
  }

  function scan() {
    document.querySelectorAll('pre:not([' + PROCESSED + '])').forEach((pre) => {
      // Skip code blocks in user messages
      if (pre.closest('[data-message-author-role="user"]')) return;
      // Skip code blocks in input / editable areas
      if (pre.closest('[contenteditable]')) return;
      processBlock(pre);
    });
  }

  // Throttle scan to avoid performance issues — ChatGPT's SPA triggers
  // hundreds of DOM mutations per message render
  let scanTimer = null;
  function throttledScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scan();
      scanTimer = null;
    }, 300);
  }

  new MutationObserver(throttledScan).observe(document.body, {
    childList: true,
    subtree: true,
  });
  scan();
  setTimeout(scan, 1000);
  setTimeout(scan, 3000);
})();
