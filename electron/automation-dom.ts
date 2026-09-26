export interface SnapshotOptions {
  mode: "compact" | "full";
  selector?: string;
  maxChars: number;
  maxControls: number;
  firstRef: number;
}
export interface ElementTarget {
  ref?: string;
  selector?: string;
}
export type PageOperation =
  | "snapshot"
  | "target"
  | "click"
  | "fill"
  | "upload"
  | "focus"
  | "check"
  | "scroll"
  | "drag"
  | "input"
  | "frame";

// This complete function is serialized into a separate Chromium world. It has no
// imports, Node APIs, or access to the browser interface's preload bridge.
export function pageOperation(
  operation: PageOperation,
  payload: Record<string, unknown>,
  namespace: string,
) {
  // How a listed control looked, so its ref can follow the control when the
  // page draws it again. It lasts only as long as the document and namespace.
  type Fingerprint = {
    tag: string;
    role: string;
    type: string;
    label: string;
    group: string;
    context: string;
    selector: string;
    url: string;
  };
  type Registry = {
    namespace: string;
    document: Document;
    elements: Map<string, Element>;
    refs: WeakMap<Element, string>;
    fingerprints: Map<string, Fingerprint>;
    secrets: WeakSet<Element>;
  };
  const world = globalThis as unknown as { __kamapathyReferences?: Registry };
  let registry = world.__kamapathyReferences;
  if (
    !registry ||
    registry.namespace !== namespace ||
    registry.document !== document
  ) {
    registry = {
      namespace,
      document,
      elements: new Map(),
      refs: new WeakMap(),
      fingerprints: new Map(),
      secrets: new WeakSet(),
    };
    world.__kamapathyReferences = registry;
  }
  const failure = (error: string, code = "element_action_failed") => ({
    ok: false as const,
    code,
    error,
  });
  // Refs this operation moved to a control the page drew again.
  const rebound: string[] = [];
  const reboundResult = () => (rebound.length ? { rebound } : {});
  // A snapshot reads the same styles many times, so it keeps them while it
  // runs. Other operations read styles fresh, after page handlers run.
  let styles: Map<Element, CSSStyleDeclaration> | undefined;
  const styleOf = (element: Element) => {
    let style = styles?.get(element);
    if (!style) {
      style = getComputedStyle(element);
      styles?.set(element, style);
    }
    return style;
  };
  // aria-hidden removes content from assistive technology, not from the
  // screen. Page text includes it, because component libraries put visible
  // labels and questions there. Controls under it stay excluded, as a modal
  // hides the page behind it this way.
  const visible = (element: Element, includeAriaHidden = false) => {
    if (
      !element.isConnected ||
      element.closest(
        includeAriaHidden
          ? "[hidden],[inert]"
          : '[hidden],[inert],[aria-hidden="true"]',
      )
    )
      return false;
    const style = styleOf(element);
    for (
      let ancestor: Element | null = element;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      if (
        ancestor instanceof HTMLDetailsElement &&
        !ancestor.open &&
        ancestor !== element
      ) {
        const summary = Array.from(ancestor.children).find(
          (child) => child.localName === "summary",
        );
        if (!summary?.contains(element)) return false;
      }
      const inherited = styleOf(ancestor);
      // Component libraries draw their own box and keep the real checkbox or
      // radio on top of it at opacity 0, where it still takes the click.
      const transparentControl =
        ancestor === element &&
        element instanceof HTMLInputElement &&
        (element.type === "checkbox" || element.type === "radio");
      if (
        (inherited.opacity === "0" && !transparentControl) ||
        inherited.display === "none" ||
        inherited.contentVisibility === "hidden"
      )
        return false;
    }
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.visibility !== "collapse" &&
      element.getClientRects().length > 0
    );
  };
  // Icon fonts draw a name such as "arrow_drop_down" as one glyph. Pages mark
  // these icons aria-hidden, whose other text a person reads.
  const iconName = (node: Node, parent: Element) =>
    /^\s*[a-z0-9_]+\s*$/.test(node.textContent || "") &&
    !!parent.closest('[aria-hidden="true"]') &&
    /material (icons|symbols)|google symbols/i.test(
      styleOf(parent).fontFamily,
    );
  const pageText = (scope: Element, maximum = Infinity) => {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let text = "",
      previousBlock: Element | null = null;
    let previousRect: DOMRect | undefined;
    for (
      let node = walker.nextNode();
      node && text.length <= maximum;
      node = walker.nextNode()
    ) {
      const parent = node.parentElement;
      if (
        !parent ||
        parent.closest(
          "script,style,noscript,template,input,textarea,select",
        ) ||
        (parent instanceof HTMLElement && parent.isContentEditable) ||
        !visible(parent, true) ||
        iconName(node, parent)
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );
      if (!rects.length) continue;
      let block = parent;
      while (
        block.parentElement &&
        ["inline", "inline-block", "contents"].includes(styleOf(block).display)
      )
        block = block.parentElement;
      const value = /^(pre|break-spaces)/.test(styleOf(parent).whiteSpace)
        ? node.textContent || ""
        : (node.textContent || "").replace(/\s+/g, " ");
      if (
        text &&
        (previousBlock !== block ||
          (previousRect && rects[0].top >= previousRect.bottom - 1))
      )
        text += "\n";
      else if (
        text &&
        previousRect &&
        rects[0].left > previousRect.right + 1 &&
        !/\s$/.test(text) &&
        !/^\s/.test(value)
      )
        text += " ";
      text += value.slice(0, Math.max(0, maximum + 1 - text.length));
      previousBlock = block;
      previousRect = rects.at(-1);
    }
    return text;
  };
  // Sites commonly hide the actual input behind a visible upload panel. Expose
  // its metadata only while its containing UI is visible, never in closed UI.
  const uploadControl = (element: Element) =>
    element instanceof HTMLInputElement && element.type === "file" &&
    element.isConnected && !element.closest('[inert],[aria-hidden="true"]') &&
    (visible(element) || (!!element.parentElement && visible(element.parentElement)));
  const unique = (selector: string) => {
    try {
      const matches = document.querySelectorAll(selector);
      if (matches.length !== 1)
        return failure(
          `Selector matched ${matches.length} elements. Use a unique selector.`,
        );
      return matches[0];
    } catch {
      return failure("Invalid CSS selector.", "invalid_selector");
    }
  };
  const target = (spec = payload as ElementTarget) => {
    if (typeof spec.ref === "string") {
      const element = registry.elements.get(spec.ref);
      if (element && element.isConnected && element.ownerDocument === document)
        return element;
      const replacement = rebind(spec.ref);
      if (replacement) {
        registry.elements.set(spec.ref, replacement);
        registry.refs.set(replacement, spec.ref);
        rebound.push(spec.ref);
        return replacement;
      }
      registry.elements.delete(spec.ref);
      registry.fingerprints.delete(spec.ref);
      return failure(
        "Element reference is stale. Take a new snapshot.",
        "stale_ref",
      );
    }
    if (typeof spec.selector === "string") return unique(spec.selector);
    return failure(
      "Provide an element reference or a unique CSS selector.",
      "invalid_target",
    );
  };
  const selectorFor = (element: Element) => {
    if (
      element.id &&
      element.id.length <= 512 &&
      document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1
    )
      return `#${CSS.escape(element.id)}`;
    const path: string[] = [];
    let current: Element | null = element;
    while (
      current &&
      current !== document.documentElement &&
      path.length < 32
    ) {
      const tag = current.localName;
      const siblings: Element[] = current.parentElement
        ? Array.from(current.parentElement.children).filter(
            (sibling) => sibling.localName === tag,
          )
        : [];
      path.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
      current = current.parentElement;
    }
    return path.join(" > ");
  };
  // Native controls and the ARIA roles people operate directly. Lists, menus
  // and tab strips are listed through their items.
  const controlQuery = [
    "a[href]",
    "button",
    "summary",
    'input:not([type="hidden"])',
    "textarea",
    "select",
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[contenteditable="plaintext-only"]',
    ...[
      "button",
      "link",
      "checkbox",
      "radio",
      "combobox",
      "option",
      "listbox",
      "menuitem",
      "menuitemcheckbox",
      "menuitemradio",
      "tab",
      "switch",
      "textbox",
      "searchbox",
      "slider",
      "spinbutton",
      "treeitem",
    ].map((role) => `[role="${role}"]`),
  ].join(",");
  const popupTrigger = '[aria-haspopup]:not([aria-haspopup="false"])';
  const popup =
    'dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"],[role="listbox"],[role="menu"],:popover-open';
  // An element a person can drag, such as an item of a reorderable list.
  const draggable = '[draggable="true"]';
  const query = `${controlQuery},${popupTrigger},${draggable},[tabindex]`;
  // A custom element that takes keyboard focus is a component acting as a
  // control, such as a Material button or select item.
  const isControl = (element: Element) =>
    element.matches(controlQuery) ||
    element.matches(popupTrigger) ||
    element.matches(draggable) ||
    (element.localName.includes("-") &&
      element.hasAttribute("tabindex") &&
      (element as HTMLElement).tabIndex >= 0);
  const insideControl = (element: Element) => {
    for (
      let match = element.closest(query);
      match;
      match = match.parentElement?.closest(query) ?? null
    )
      if (isControl(match)) return true;
    return false;
  };
  const clean = (value: string | null | undefined) =>
    (value || "").replace(/\s+/g, " ").trim();
  // Text an element carries itself, without the icons it marks aria-hidden.
  // Icon fonts render names such as "upload" in text, which would otherwise
  // turn a button's label into "uploadUpload".
  const ownText = (element: Element) => {
    let text = "";
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const hidden = node.parentElement?.closest(
        '[aria-hidden="true"],script,style',
      );
      if (!hidden || !element.contains(hidden)) text += node.textContent;
    }
    return clean(text);
  };
  // The choice a custom select shows as its own text. A select whose list
  // opens inside it, as Angular Material's does, also holds the options, and
  // their text is not its value.
  const shownText = (element: Element) => {
    let text = "";
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const inner = node.parentElement?.closest(
        `[aria-hidden="true"],script,style,${popup},${controlQuery}`,
      );
      if (!inner || inner === element || !element.contains(inner))
        text += node.textContent;
    }
    return clean(text);
  };
  const labelledBy = (element: Element) =>
    clean(
      (element.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => {
          const source = id ? document.getElementById(id) : null;
          return source ? ownText(source) || clean(source.textContent) : "";
        })
        .join(" "),
    );
  const fieldLike = (element: Element) =>
    (element instanceof HTMLInputElement &&
      !["submit", "reset", "button", "image"].includes(element.type)) ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable) ||
    [
      "textbox",
      "searchbox",
      "combobox",
      "spinbutton",
      "slider",
      "switch",
      "checkbox",
      "radio",
    ].includes(element.getAttribute("role") || "");
  // The name a page gives a control, then what a person sees beside it. It
  // depends only on the element and page, not on the rest of a snapshot.
  const labelOf = (element: Element) => {
    const field = element as HTMLInputElement;
    let label =
      clean(element.getAttribute("aria-label")) ||
      labelledBy(element) ||
      clean(
        field.labels
          ? Array.from(field.labels)
              .map((source) =>
                source.querySelector('[aria-hidden="true"]')
                  ? ownText(source) || source.innerText
                  : source.innerText,
              )
              .join(" ")
          : "",
      ) ||
      clean(element.getAttribute("placeholder"));
    if (!label) {
      if (
        element instanceof HTMLInputElement &&
        ["submit", "reset", "button"].includes(element.type)
      )
        label = clean(
          element.value ||
            (element.type === "submit"
              ? "Submit"
              : element.type === "reset"
                ? "Reset"
                : ""),
        );
      else if (
        element instanceof HTMLInputElement &&
        element.type === "image"
      )
        label = clean(element.alt);
      else if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement) &&
        !(element instanceof HTMLSelectElement) &&
        !(element instanceof HTMLElement && element.isContentEditable)
      )
        label =
          element.getAttribute("role") === "combobox"
            ? shownText(element)
            : ["textbox", "searchbox", "spinbutton", "slider"].includes(
                  element.getAttribute("role") || "",
                )
              ? ""
              : ownText(element);
    }
    label ||= clean(element.getAttribute("title"));
    // An icon-only control is best named by its icon.
    if (!label && !fieldLike(element)) label = clean(element.textContent);
    // A question drawn beside a field, without being tied to it, names the
    // field when their shared container holds no other control.
    for (
      let container = fieldLike(element) ? element.parentElement : null,
        depth = 0;
      !label && container && container !== document.body && depth < 6;
      container = container.parentElement, depth++
    ) {
      if (
        Array.from(container.querySelectorAll(query)).some(
          (other) =>
            other !== element &&
            !element.contains(other) &&
            isControl(other) &&
            visible(other),
        )
      )
        break;
      // A custom text field's own text is its value, not its name.
      const own = clean(pageText(element, 200));
      label = clean(
        own
          ? clean(pageText(container, 400)).replace(own, "")
          : pageText(container, 200),
      );
    }
    return label.slice(0, 200);
  };
  // The nearest text before a set of choices, such as the question above
  // radio buttons a component library draws without a name.
  const textBefore = (container: Element, first: Element) => {
    let root = container;
    for (
      let depth = 0;
      depth < 3 && root.parentElement && root !== document.body;
      depth++
    )
      root = root.parentElement;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    walker.currentNode = first;
    for (
      let node = walker.previousNode(), steps = 0;
      node && steps < 200;
      node = walker.previousNode(), steps++
    ) {
      const parent = node.parentElement;
      if (
        !parent ||
        !clean(node.textContent) ||
        parent.closest(
          "script,style,noscript,template,input,textarea,select",
        ) ||
        insideControl(parent) ||
        parent.closest("label")?.control ||
        !visible(parent, true) ||
        iconName(node, parent)
      )
        continue;
      let block = parent;
      while (
        block !== root &&
        block.parentElement &&
        ["inline", "inline-block", "contents"].includes(
          styleOf(block).display,
        )
      )
        block = block.parentElement;
      return block.contains(first)
        ? clean(node.textContent)
        : clean(pageText(block, 200));
    }
    return "";
  };
  const groups = new Map<Element, string>();
  // The question a radio button or checkbox answers with its neighbors: a
  // fieldset legend, a named group, or the text before the choices.
  const groupOf = (element: Element) => {
    const role = element.getAttribute("role");
    const native =
      element instanceof HTMLInputElement &&
      (element.type === "radio" || element.type === "checkbox");
    if (!native && role !== "radio" && role !== "checkbox") return "";
    const choices =
      'input[type="radio"],input[type="checkbox"],[role="radio"],[role="checkbox"]';
    let container = element.parentElement?.closest(
      'fieldset,[role="radiogroup"],[role="group"]',
    );
    let first = container?.querySelector(choices);
    // Radio buttons sharing a name are one group wherever they are drawn.
    if (!container && native && element.type === "radio" && element.name) {
      const peers = Array.from(
        document.getElementsByName(element.name),
      ).filter(
        (peer) =>
          peer instanceof HTMLInputElement &&
          peer.type === element.type &&
          peer.form === element.form,
      );
      if (peers.length > 1) {
        container = element.parentElement;
        while (container && !peers.every((peer) => container!.contains(peer)))
          container = container.parentElement;
        first = peers[0];
      }
    }
    if (!container || !first) return "";
    let name = groups.get(container);
    if (name === undefined) {
      const legend = Array.from(container.children).find(
        (child) => child.localName === "legend",
      );
      name =
        clean(container.getAttribute("aria-label")) ||
        labelledBy(container) ||
        (legend ? ownText(legend) || clean(legend.textContent) : "") ||
        textBefore(container, first);
      groups.set(container, name);
    }
    return name.slice(0, 200);
  };
  // Checked, selected, expanded and pressed states, from native controls and
  // the ARIA attributes component libraries set.
  const stateOf = (element: Element) => {
    const role = element.getAttribute("role") || "";
    const aria = (name: string) => {
      const value = element.getAttribute(name);
      return value === "true"
        ? true
        : value === "false"
          ? false
          : value === "mixed"
            ? ("mixed" as const)
            : undefined;
    };
    const state: {
      checked?: boolean | "mixed";
      selected?: boolean;
      expanded?: boolean;
      pressed?: boolean | "mixed";
    } = {};
    if (
      element instanceof HTMLInputElement &&
      (element.type === "checkbox" || element.type === "radio")
    )
      state.checked =
        element.type === "checkbox" && element.indeterminate
          ? "mixed"
          : element.checked;
    else if (
      [
        "checkbox",
        "radio",
        "switch",
        "menuitemcheckbox",
        "menuitemradio",
        "option",
      ].includes(role)
    ) {
      const checked = aria("aria-checked");
      if (checked !== undefined) state.checked = checked;
      else if (role !== "option") state.checked = false;
    }
    if (["option", "tab", "treeitem"].includes(role)) {
      const selected = aria("aria-selected");
      if (typeof selected === "boolean") state.selected = selected;
    }
    const expanded =
      element.localName === "summary" &&
      element.parentElement instanceof HTMLDetailsElement
        ? element.parentElement.open
        : aria("aria-expanded");
    if (typeof expanded === "boolean") state.expanded = expanded;
    const pressed = aria("aria-pressed");
    if (pressed !== undefined) state.pressed = pressed;
    return state;
  };
  // Passwords, one-time codes and payment card fields never show a value, even
  // after a "show password" toggle turns the field into plain text.
  const secretName = /(^|[^a-z])(pass(word|wd|code|phrase)?|pwd|otp|cvc|cvv|pin)([^a-z]|$)/i;
  const secretField = (element: Element) =>
    (element instanceof HTMLInputElement && element.type === "password") ||
    secretName.test(`${element.getAttribute("name") || ""} ${element.id}`) ||
    (element.getAttribute("autocomplete") || "")
      .toLowerCase()
      .split(/\s+/)
      .some(
        (token) =>
          ["current-password", "new-password", "one-time-code"].includes(
            token,
          ) || token.startsWith("cc-"),
      ) ||
    !["", "none"].includes(
      styleOf(element).getPropertyValue("-webkit-text-security"),
    );
  const secret = (element: Element) => {
    if (registry.secrets.has(element)) return true;
    const hidden = secretField(element);
    if (hidden) registry.secrets.add(element);
    return hidden;
  };
  // A field's current value, so an agent can check what it filled.
  const valueOf = (element: Element) => {
    const role = element.getAttribute("role");
    if (element instanceof HTMLInputElement)
      return [
        "text",
        "search",
        "tel",
        "url",
        "email",
        "password",
        "number",
        "date",
        "time",
        "datetime-local",
        "month",
        "week",
        "range",
        "color",
      ].includes(element.type)
        ? element.value
        : undefined;
    if (element instanceof HTMLTextAreaElement) return element.value;
    if (element instanceof HTMLSelectElement)
      return element.multiple ? undefined : element.value;
    if (element instanceof HTMLElement && element.isContentEditable)
      return element.innerText;
    if (role === "slider" || role === "spinbutton")
      return (
        element.getAttribute("aria-valuetext") ||
        element.getAttribute("aria-valuenow") ||
        ""
      );
    if (role === "combobox") return shownText(element);
    if ((role === "textbox" || role === "searchbox") && element instanceof HTMLElement)
      return element.innerText;
    return undefined;
  };
  // The first 200 characters of an element's text, without field contents.
  const leadingText = (element: Element) => {
    let text = "";
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (
      let node = walker.nextNode();
      node && text.length < 400;
      node = walker.nextNode()
    ) {
      const parent = node.parentElement;
      if (
        parent &&
        !parent.closest("script,style,noscript,template,textarea") &&
        !(parent instanceof HTMLElement && parent.isContentEditable)
      )
        text += node.textContent;
    }
    return clean(text).slice(0, 200);
  };
  // Text around a control that tells it apart from controls with the same
  // label, such as the Remove buttons of different rows.
  const contextOf = (element: Element) => {
    const own = leadingText(element);
    for (
      let ancestor = element.parentElement, depth = 0;
      ancestor && depth < 4;
      ancestor = ancestor.parentElement, depth++
    ) {
      const text = leadingText(ancestor);
      if (text !== own) return text;
    }
    return "";
  };
  // A ref whose element the page replaced follows the control drawn in its
  // place: the same kind of control with the same label, question and
  // surrounding text, on the same URL, that no other ref holds. The element at
  // the old position comes first, then a single match anywhere. Anything less
  // certain stays stale. A snapshot records no fingerprint for a control that
  // looked like another one, and a file input is never re-bound, so files go
  // only to the input an agent observed.
  const rebind = (ref: string) => {
    const print = registry.fingerprints.get(ref);
    if (
      !print ||
      print.url !== location.href ||
      (print.tag === "input" && print.type.toLowerCase() === "file") ||
      (!print.label && !print.selector.startsWith("#"))
    )
      return undefined;
    const matches = (element: Element) => {
      const owner = registry.refs.get(element);
      return (
        element.localName === print.tag &&
        (element.getAttribute("role") || "") === print.role &&
        (element.getAttribute("type") || "") === print.type &&
        !(owner && registry.elements.get(owner) === element) &&
        labelOf(element) === print.label &&
        contextOf(element) === print.context &&
        groupOf(element) === print.group &&
        visible(element)
      );
    };
    try {
      const same = document.querySelector(print.selector);
      if (same && matches(same)) return same;
    } catch {}
    if (!print.label) return undefined;
    let found: Element | undefined;
    let compared = 0;
    for (const element of document.getElementsByTagName(print.tag)) {
      if (
        (element.getAttribute("role") || "") !== print.role ||
        (element.getAttribute("type") || "") !== print.type
      )
        continue;
      // Too many lookalikes to compare cannot prove a single match.
      if (++compared > 2000) return undefined;
      if (!matches(element)) continue;
      if (found) return undefined;
      found = element;
    }
    return found;
  };
  // A control drawn with no size, such as a radio button in a list row that
  // takes the row's clicks, cannot take a native click at its own point. It is
  // clicked in the page when the box around it is on screen and uncovered.
  const emptyBox = (element: Element) => {
    const box = element.getBoundingClientRect();
    return box.width === 0 || box.height === 0;
  };
  const emptyBoxBlocked = (element: Element) => {
    const box = element.getBoundingClientRect();
    let host = element.parentElement;
    while (host && emptyBox(host)) host = host.parentElement;
    const around = host?.getBoundingClientRect();
    const x = around
      ? Math.min(Math.max(box.left, around.left, 0), around.right - 1)
      : -1;
    const y = around
      ? Math.min(Math.max(box.top, around.top, 0), around.bottom - 1)
      : -1;
    if (
      box.left < 0 ||
      box.top < 0 ||
      box.left > innerWidth ||
      box.top > innerHeight ||
      x < 0 ||
      y < 0 ||
      x >= innerWidth ||
      y >= innerHeight
    )
      return failure("Element is outside the viewport.");
    const hit = document.elementFromPoint(x, y);
    if (!hit || !host!.contains(hit))
      return failure("Another element covers the target.", "element_obscured");
  };
  if (operation === "snapshot") {
    styles = new Map();
    const options = payload as unknown as SnapshotOptions;
    let scope: Element = document.body || document.documentElement;
    if (options.selector) {
      const selected = unique(options.selector);
      if (!(selected instanceof Element)) return selected;
      scope = selected;
    }
    // A detached element's fingerprint stays, so its ref can follow the
    // control the page draws in its place.
    for (const [ref, element] of registry.elements)
      if (!element.isConnected) registry.elements.delete(ref);
    // Expired references fail safely instead of being assigned to another node.
    while (registry.elements.size > 5000) {
      const ref = registry.elements.keys().next().value!;
      registry.elements.delete(ref);
      registry.fingerprints.delete(ref);
    }
    while (registry.fingerprints.size > 5000)
      registry.fingerprints.delete(registry.fingerprints.keys().next().value!);
    const found = (scope.matches(query) ? [scope] : [])
      .concat(Array.from(scope.querySelectorAll(query)))
      .filter(
        (element) =>
          isControl(element) && (visible(element) || uploadControl(element)),
      );
    const listed = new Set(found);
    const holders = new Set<Element>();
    for (const element of found)
      for (
        let parent = element.parentElement;
        parent && !holders.has(parent);
        parent = parent.parentElement
      )
        holders.add(parent);
    const items =
      '[role="option"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="treeitem"],[role="tab"]';
    const candidates = found.filter((element) => {
      // A wrapper listed only for its focus or popup, or a list of choices, is
      // operated through the controls inside it. A draggable one is also
      // dragged as a whole.
      if (
        holders.has(element) &&
        ((!element.matches(controlQuery) && !element.matches(draggable)) ||
          [
            "listbox",
            "menu",
            "menubar",
            "radiogroup",
            "tablist",
            "tree",
            "grid",
          ].includes(element.getAttribute("role") || ""))
      )
        return false;
      // A row drawn as a button around its controls, as Google's Angular
      // components draw a tree row around its tree item, is also listed
      // through them when it has no name or text of its own.
      if (
        holders.has(element) &&
        element.getAttribute("role") === "button" &&
        !element.matches("a[href],button,summary,input,textarea,select") &&
        !element.matches(draggable) &&
        !element.hasAttribute("aria-label") &&
        !element.hasAttribute("aria-labelledby")
      ) {
        let own = false;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (
          let node = walker.nextNode();
          node && !own;
          node = walker.nextNode()
        ) {
          if (
            !clean(node.textContent) ||
            node.parentElement?.closest('[aria-hidden="true"]')
          )
            continue;
          let inner = node.parentElement;
          while (inner && inner !== element && !listed.has(inner))
            inner = inner.parentElement;
          own = inner === element;
        }
        if (!own) return false;
      }
      // A checkbox, radio button or switch drawn inside an option, menu item,
      // tab or tree item is part of that item.
      if (element.matches('[role="checkbox"],[role="radio"],[role="switch"]'))
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        )
          if (listed.has(parent) && parent.matches(items)) return false;
      return true;
    });
    // Pages also draw clickable and draggable items with no control semantics.
    // A few with their own short text are listed after every other control.
    const clickable: Element[] = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
    const skipChildren = () => {
      for (;;) {
        const sibling = walker.nextSibling();
        if (sibling) return sibling;
        if (!walker.parentNode()) return null;
      }
    };
    const searchEnd = performance.now() + 50;
    let node = walker.nextNode();
    while (node && clickable.length < 30 && performance.now() < searchEnd) {
      const element = node as Element;
      const style = styleOf(element);
      if (
        listed.has(element) ||
        style.display === "none" ||
        /^(script|style|noscript|template|svg|select)$/.test(element.localName)
      ) {
        node = skipChildren();
        continue;
      }
      // The element that sets the pointer, not each child inheriting it.
      if (
        /^(pointer|grab|move)$/.test(style.cursor) &&
        !holders.has(element) &&
        styleOf(element.parentElement || element).cursor !== style.cursor &&
        !(element instanceof HTMLLabelElement && element.control)
      ) {
        const text =
          clean(element.getAttribute("aria-label")) || ownText(element);
        if (text && text.length <= 200 && visible(element)) {
          clickable.push(element);
          node = skipChildren();
          continue;
        }
      }
      node = walker.nextNode();
    }
    const all = clickable.length
      ? candidates
          .concat(clickable)
          .sort((first, second) =>
            first.compareDocumentPosition(second) &
            Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
          )
      : candidates;
    // When a page has more controls than the budget, list what a person can
    // act on now: open dialogs and popups, then pinned bars on screen, then
    // the rest of the screen, then everything else, keeping page order.
    let chosen = all;
    if (all.length > options.maxControls) {
      const fallback = new Set(clickable);
      // The nearest fixed or sticky box around an element, if any.
      const pinned = new Map<Element, Element | null>();
      const pinOf = (element: Element) => {
        const chain: Element[] = [];
        let result: Element | null = null;
        for (
          let current: Element | null = element;
          current;
          current = current.parentElement
        ) {
          const known = pinned.get(current);
          if (known !== undefined) {
            result = known;
            break;
          }
          chain.push(current);
          if (["fixed", "sticky"].includes(styleOf(current).position)) {
            result = current;
            break;
          }
        }
        for (const item of chain) pinned.set(item, result);
        return result;
      };
      // A pinned bar, such as a header, a banner or the action bar at the
      // bottom, is short or spans the page. A tall, narrow pinned column, such
      // as a navigation sidebar or a table of contents, stays the same on
      // every page, so it comes after the rest of the screen.
      const bar = (pin: Element) => {
        const box = pin.getBoundingClientRect();
        return (
          box.height <= innerHeight / 3 || box.width >= (innerWidth * 2) / 3
        );
      };
      const onScreen = (element: Element) => {
        const box = element.getBoundingClientRect();
        return (
          box.bottom > 0 &&
          box.right > 0 &&
          box.top < innerHeight &&
          box.left < innerWidth
        );
      };
      const rank = (element: Element) => {
        // A file input hidden inside upload UI sits where its parent is.
        const shown = onScreen(
          element.getClientRects().length
            ? element
            : element.parentElement || element,
        );
        // A drawer kept rendered off screen is not an open popup.
        const open = element.parentElement?.closest(popup);
        const pin = shown ? pinOf(element) : null;
        // The trigger of an open popup shows its current choice.
        const trigger =
          shown &&
          element.getAttribute("aria-expanded") === "true" &&
          !["", "false", null].includes(element.getAttribute("aria-haspopup"));
        const tier = trigger
          ? 0
          : open && onScreen(open)
            ? shown
              ? 0
              : 1
            : !shown
              ? 5
              : !pin
                ? 3
                : bar(pin)
                  ? 2
                  : 4;
        return tier * 2 + (fallback.has(element) ? 1 : 0);
      };
      chosen = all
        .map((element, index) => ({ element, index, rank: rank(element) }))
        .sort(
          (first, second) =>
            first.rank - second.rank || first.index - second.index,
        )
        .slice(0, options.maxControls)
        .sort((first, second) => first.index - second.index)
        .map((item) => item.element);
    }
    const limit = options.mode === "compact" ? 80 : 200;
    let nextRef = options.firstRef;
    let remainingOptions = 100;
    let optionsTruncated = false;
    const prints = new Map<string, Fingerprint>();
    const interactables = chosen.map((element, index) => {
      let ref = registry.refs.get(element);
      if (!ref || registry.elements.get(ref) !== element) {
        ref = `@e${nextRef++}`;
        registry.refs.set(element, ref);
        registry.elements.set(ref, element);
      }
      const label = labelOf(element);
      const hidden = secret(element);
      const value = valueOf(element);
      const group = groupOf(element);
      const selector = selectorFor(element);
      prints.set(ref, {
        tag: element.localName,
        role: element.getAttribute("role") || "",
        type: element.getAttribute("type") || "",
        label,
        group,
        context: contextOf(element),
        selector,
        url: location.href,
      });
      const entry = {
        index,
        ref,
        tag: element.localName,
        role: element.getAttribute("role") || element.localName,
        type: element.getAttribute("type") || undefined,
        label: label.slice(0, limit),
        selector,
        disabled:
          element.matches(":disabled") ||
          element.getAttribute("aria-disabled") === "true",
        ...stateOf(element),
        ...(!value ||
        (element.getAttribute("role") === "combobox" && value === label)
          ? {}
          : hidden
            ? { valueHidden: true }
            : value.length > limit
              ? { value: value.slice(0, limit), valueTruncated: true }
              : { value }),
        ...(group ? { group: group.slice(0, limit) } : {}),
        ...(element instanceof HTMLInputElement && element.type === "file"
          ? { accept: element.accept.slice(0, 256), multiple: element.multiple, hidden: !visible(element) }
          : {}),
        ...(element instanceof HTMLSelectElement
          ? (() => {
              const choices = Array.from(element.options).filter(
                (option) => option.value.length <= 256,
              );
              const included = choices.slice(
                0,
                Math.min(20, remainingOptions),
              );
              remainingOptions -= included.length;
              const truncated = included.length < element.options.length;
              optionsTruncated ||= truncated;
              return {
                options: included.map((option) => ({
                  value: option.value,
                  label: option.label
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 80),
                  disabled:
                    option.disabled || !!option.closest("optgroup")?.disabled,
                  ...(option.selected && !hidden ? { selected: true } : {}),
                })),
                ...(truncated ? { optionsTruncated: true } : {}),
              };
            })()
          : {}),
      };
      return entry;
    });
    // A control that looks like another visible control, listed or not and in
    // or outside a scoped snapshot, cannot be told apart from it once it is
    // gone, so its ref never follows a redrawn control.
    const kindOf = (print: Pick<Fingerprint, "tag" | "role" | "type">) =>
      JSON.stringify([print.tag, print.role, print.type]);
    const keyOf = (print: Omit<Fingerprint, "selector" | "url">) =>
      JSON.stringify([
        print.tag,
        print.role,
        print.type,
        print.label,
        print.group,
        print.context,
      ]);
    const lookalikes = new Map<string, number>();
    const kinds = new Set<string>();
    const names = new Set<string>();
    for (const print of prints.values()) {
      lookalikes.set(keyOf(print), (lookalikes.get(keyOf(print)) || 0) + 1);
      kinds.add(kindOf(print));
      names.add(kindOf(print) + print.label);
    }
    const others = new Set(
      options.selector
        ? Array.from(document.querySelectorAll(query)).filter(
            (element) => isControl(element) && visible(element),
          )
        : [],
    );
    for (const element of all) others.add(element);
    for (const element of chosen) others.delete(element);
    for (const element of others) {
      const print = {
        tag: element.localName,
        role: element.getAttribute("role") || "",
        type: element.getAttribute("type") || "",
        label: "",
        group: "",
        context: "",
      };
      if (!kinds.has(kindOf(print))) continue;
      print.label = labelOf(element);
      if (!names.has(kindOf(print) + print.label)) continue;
      print.group = groupOf(element);
      print.context = contextOf(element);
      const count = lookalikes.get(keyOf(print));
      if (count) lookalikes.set(keyOf(print), count + 1);
    }
    for (const [ref, print] of prints)
      if (lookalikes.get(keyOf(print))! > 1) registry.fingerprints.delete(ref);
      else registry.fingerprints.set(ref, print);
    const omitted = all.length - chosen.length;
    let text = pageText(scope, options.maxChars);
    if (options.mode === "compact")
      text = text
        .replace(/[\t ]+/g, " ")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();
    return {
      url: location.href,
      title: document.title,
      text: text.slice(0, options.maxChars),
      interactables,
      ...(omitted ? { omittedControls: omitted } : {}),
      truncated:
        text.length > options.maxChars || omitted > 0 || optionsTruncated,
    };
  }
  if (operation === "check") {
    let scope: Element = document.body || document.documentElement;
    if (typeof payload.selector === "string") {
      let matches: NodeListOf<Element>;
      try {
        matches = document.querySelectorAll(payload.selector);
      } catch {
        return failure("Invalid CSS selector.", "invalid_selector");
      }
      if (matches.length !== 1 || !visible(matches[0], true))
        return { ok: true, matched: false };
      scope = matches[0];
    }
    const text = pageText(scope);
    return {
      ok: true,
      matched:
        typeof payload.text === "string"
          ? text.includes(payload.text)
          : typeof payload.selector === "string" ||
            document.readyState !== "loading",
    };
  }
  if (operation === "input") {
    // Chromium drops native input that a page receives before it renders its
    // first frame after a navigation, so the caller counts what arrived.
    const world = globalThis as unknown as {
      kamapathyInput?: { mouse: number; key: number; drag: number };
    };
    if (!world.kamapathyInput) {
      const counts = (world.kamapathyInput = { mouse: 0, key: 0, drag: 0 });
      addEventListener("mousedown", () => { counts.mouse += 1; }, { capture: true });
      addEventListener("keydown", () => { counts.key += 1; }, { capture: true });
      // An HTML5 drag starts unless the page cancels dragstart, which its own
      // handlers decide after this listener runs.
      addEventListener("dragstart", (event) => {
        setTimeout(() => { if (!event.defaultPrevented) counts.drag += 1; });
      }, { capture: true });
    }
    return { ok: true, ...world.kamapathyInput };
  }
  if (operation === "frame")
    return new Promise((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve({ ok: true })),
      ),
    );
  if (operation === "scroll") {
    const direction = payload.direction as string;
    const pixels = payload.pixels as number;
    const vertical = direction === "up" || direction === "down";
    const forward = direction === "down" || direction === "right";
    // Whether a box can move this way, as a wheel would move it. Right-to-left
    // boxes scroll horizontally through negative offsets.
    const room = (position: number, extent: number, rtl: boolean) => {
      if (extent < 1) return false;
      const [low, high] = !vertical && rtl ? [-extent, 0] : [0, extent];
      return forward ? position < high - 0.5 : position > low + 0.5;
    };
    const canScroll = (element: Element) => {
      const style = styleOf(element);
      return (
        /^(auto|scroll|overlay)$/.test(
          vertical ? style.overflowY : style.overflowX,
        ) &&
        room(
          vertical ? element.scrollTop : element.scrollLeft,
          vertical
            ? element.scrollHeight - element.clientHeight
            : element.scrollWidth - element.clientWidth,
          style.direction === "rtl",
        )
      );
    };
    // The page scrolls unless its overflow, set on the root or passed on from
    // the body, keeps a person from scrolling it.
    const root = document.scrollingElement || document.documentElement;
    const rootStyle = styleOf(document.documentElement);
    const viewport =
      rootStyle.overflowX === "visible" &&
      rootStyle.overflowY === "visible" &&
      document.body
        ? styleOf(document.body)
        : rootStyle;
    const pageBox = (element: Element) =>
      element === root ||
      element === document.documentElement ||
      (element === document.body && viewport !== rootStyle);
    const pageScrolls =
      !/^(hidden|clip)$/.test(
        vertical ? viewport.overflowY : viewport.overflowX,
      ) &&
      room(
        vertical ? scrollY : scrollX,
        vertical
          ? root.scrollHeight - root.clientHeight
          : root.scrollWidth - root.clientWidth,
        rootStyle.direction === "rtl",
      );
    // A target scrolls the panel holding it. Without one, a page that cannot
    // scroll this way scrolls the panel under the middle of the viewport.
    let start: Element | null = null;
    if (payload.ref !== undefined || payload.selector !== undefined) {
      const element = target();
      if (!(element instanceof Element)) return element;
      if (!visible(element)) return failure("Element is not visible.");
      start = element;
    } else if (!pageScrolls)
      start = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    let panel: Element | undefined;
    for (
      let current = start;
      current && !pageBox(current);
      current = current.parentElement
    )
      if (canScroll(current)) {
        panel = current;
        break;
      }
    const offsets = () =>
      panel ? [panel.scrollLeft, panel.scrollTop] : [scrollX, scrollY];
    const before = offsets();
    // Scripts can scroll a page a person cannot, such as the page behind a
    // modal that locks scrolling. A wheel would leave it still, and so does
    // Kamapathy.
    if (panel || pageScrolls)
      (panel || window).scrollBy({
        left:
          direction === "right" ? pixels : direction === "left" ? -pixels : 0,
        top: direction === "down" ? pixels : direction === "up" ? -pixels : 0,
        behavior: "instant",
      });
    const [x, y] = offsets();
    return {
      ok: true,
      scrolled: panel ? "element" : "page",
      ...(panel ? { selector: selectorFor(panel) } : {}),
      x,
      y,
      moved: x !== before[0] || y !== before[1],
      ...reboundResult(),
    };
  }
  if (operation === "drag") {
    const source = target(payload.source as ElementTarget);
    if (!(source instanceof Element)) return source;
    const destination = target(payload.target as ElementTarget);
    if (!(destination instanceof Element)) return destination;
    if (!visible(source) || !visible(destination))
      return failure("Element is not visible.");
    if (
      source.matches(":disabled") ||
      source.getAttribute("aria-disabled") === "true"
    )
      return failure("Element is disabled.");
    if (source.contains(destination))
      return failure(
        "Drag onto an element outside the one being dragged.",
        "invalid_target",
      );
    if (emptyBox(source) || emptyBox(destination))
      return failure("Element has no area to drag from or onto.");
    // The middle of the part of an element inside the viewport.
    const centre = (element: Element) => {
      const box = element.getBoundingClientRect();
      const left = Math.max(0, box.left),
        right = Math.min(innerWidth, box.right);
      const top = Math.max(0, box.top),
        bottom = Math.min(innerHeight, box.bottom);
      return right > left && bottom > top
        ? { x: (left + right) / 2, y: (top + bottom) / 2 }
        : undefined;
    };
    source.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "instant",
    });
    if (!centre(destination))
      destination.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "instant",
      });
    const from = centre(source),
      to = centre(destination);
    if (!from || !to)
      return failure(
        "Scroll so the source and target are both on screen, then drag again.",
        "drag_out_of_view",
      );
    for (const [element, point] of [
      [source, from],
      [destination, to],
    ] as const) {
      const hit = document.elementFromPoint(point.x, point.y);
      if (!hit || !element.contains(hit))
        return failure("Another element covers the target.", "element_obscured");
    }
    return { ok: true, from, to, ...reboundResult() };
  }
  const element = target();
  if (!(element instanceof Element)) return element;
  if (!(element instanceof HTMLElement))
    return failure("Element does not support this action.");
  if (operation === "upload") {
    if (!uploadControl(element))
      return failure("Use a file input in the currently visible upload form.", "invalid_upload_target");
    const input = element as HTMLInputElement;
    if (input.matches(":disabled") || input.getAttribute("aria-disabled") === "true")
      return failure("File input is disabled.");
    if (input.webkitdirectory)
      return failure("Directory uploads are not supported.");
    const files = payload.files as { name: string; type: string; data: string }[];
    if (!input.multiple && files.length !== 1)
      return failure("This input accepts one file at a time.", "invalid_files");
    const accepted = input.accept.toLowerCase().split(",").map((item) => item.trim()).filter(Boolean);
    for (const file of files) {
      if (accepted.length && !accepted.some((rule) =>
        rule.startsWith(".") ? file.name.toLowerCase().endsWith(rule) :
        rule.endsWith("/*") ? file.type.toLowerCase().startsWith(rule.slice(0, -1)) :
        rule === file.type.toLowerCase()))
        return failure("A file does not match this input's accepted file types.", "invalid_file_type");
    }
    const transfer = new DataTransfer();
    for (const file of files) {
      const binary = atob(file.data);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      transfer.items.add(new File([bytes], file.name, { type: file.type }));
    }
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")!.set!.call(input, transfer.files);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, selected: files.length };
  }
  if (!visible(element)) return failure("Element is not visible.");
  if (
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true"
  )
    return failure("Element is disabled.");
  element.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: "instant",
  });
  if (operation === "focus") {
    element.focus({ preventScroll: true });
    if (
      document.activeElement !== element &&
      !element.contains(document.activeElement)
    )
      return failure("Element could not be focused.");
    return { ok: true, ...reboundResult() };
  }
  if (operation === "click") {
    if (!emptyBox(element))
      return failure("The control changed before the click. Inspect it again.");
    const blocked = emptyBoxBlocked(element);
    if (blocked) return blocked;
    element.click();
    return { ok: true, ...reboundResult() };
  }
  if (operation === "target") {
    if (emptyBox(element))
      return (
        emptyBoxBlocked(element) || { ok: true, empty: true, ...reboundResult() }
      );
    const rectangle = element.getBoundingClientRect();
    const left = Math.max(0, rectangle.left),
      right = Math.min(innerWidth, rectangle.right);
    const top = Math.max(0, rectangle.top),
      bottom = Math.min(innerHeight, rectangle.bottom);
    if (right <= left || bottom <= top)
      return failure("Element is outside the viewport.");
    const x = (left + right) / 2,
      y = (top + bottom) / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit || (hit !== element && !element.contains(hit)))
      return failure("Another element covers the target.", "element_obscured");
    return { ok: true, x, y, ...reboundResult() };
  }
  if (element.hasAttribute("readonly")) return failure("Element is read only.");
  const value = payload.value as string;
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const validateValue = () => {
      if (element instanceof HTMLInputElement) {
        if (
          ![
            "text",
            "search",
            "tel",
            "url",
            "email",
            "password",
            "number",
            "date",
            "time",
            "datetime-local",
            "month",
            "week",
          ].includes(element.type)
        )
          return failure("This input type does not support fill.");
        // Validate Chromium's normalization before touching the actual field.
        const probe = document.createElement("input");
        probe.type = element.type;
        probe.value = value;
        if (probe.value !== value)
          return failure(
            "The value is not valid for this input type.",
            "invalid_value",
          );
      }
      if (element instanceof HTMLSelectElement) {
        if (element.multiple)
          return failure("Multiple selects do not support fill.");
        const matches = Array.from(element.options).filter(
          (option) => option.value === value,
        );
        if (matches.length !== 1)
          return failure(
            "The value must match exactly one option.",
            "invalid_value",
          );
        if (matches[0].disabled || matches[0].closest("optgroup")?.disabled)
          return failure("The requested option is disabled.", "invalid_value");
      }
    };
    const invalidValue = validateValue();
    if (invalidValue) return invalidValue;
    const prototype =
      element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLSelectElement.prototype;
    element.focus({ preventScroll: true });
    if (
      !visible(element) ||
      element.matches(":disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.hasAttribute("readonly")
    )
      return failure(
        "The field changed while it was being focused. Inspect it again.",
      );
    const changedValue = validateValue();
    if (changedValue) return changedValue;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
      element,
      value,
    );
  } else if (element.isContentEditable) {
    element.focus({ preventScroll: true });
    if (!visible(element) || !element.isContentEditable)
      return failure(
        "The field changed while it was being focused. Inspect it again.",
      );
    element.textContent = value;
  } else return failure("Element is not an editable field.");
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, ...reboundResult() };
}
