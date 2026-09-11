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
  | "fill"
  | "focus"
  | "check"
  | "scroll";

// This complete function is serialized into a separate Chromium world. It has no
// imports, Node APIs, or access to the browser interface's preload bridge.
export function pageOperation(
  operation: PageOperation,
  payload: Record<string, unknown>,
  namespace: string,
) {
  type Registry = {
    namespace: string;
    document: Document;
    elements: Map<string, Element>;
    refs: WeakMap<Element, string>;
  };
  const world = globalThis as unknown as { __groveReferences?: Registry };
  let registry = world.__groveReferences;
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
    };
    world.__groveReferences = registry;
  }
  const failure = (error: string, code = "element_action_failed") => ({
    ok: false as const,
    code,
    error,
  });
  const visible = (element: Element) => {
    if (
      !element.isConnected ||
      element.closest('[hidden],[inert],[aria-hidden="true"]')
    )
      return false;
    const style = getComputedStyle(element);
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
      const inherited = getComputedStyle(ancestor);
      if (
        inherited.opacity === "0" ||
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
        !visible(parent)
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
        ["inline", "inline-block", "contents"].includes(
          getComputedStyle(block).display,
        )
      )
        block = block.parentElement;
      const value = /^(pre|break-spaces)/.test(
        getComputedStyle(parent).whiteSpace,
      )
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
  const target = () => {
    if (typeof payload.ref === "string") {
      const element = registry.elements.get(payload.ref);
      if (
        !element ||
        !element.isConnected ||
        element.ownerDocument !== document
      ) {
        registry.elements.delete(payload.ref);
        return failure(
          "Element reference is stale. Take a new snapshot.",
          "stale_ref",
        );
      }
      return element;
    }
    if (typeof payload.selector === "string") return unique(payload.selector);
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
  if (operation === "snapshot") {
    const options = payload as unknown as SnapshotOptions;
    let scope: Element = document.body || document.documentElement;
    if (options.selector) {
      const selected = unique(options.selector);
      if (!(selected instanceof Element)) return selected;
      scope = selected;
    }
    for (const [ref, element] of registry.elements)
      if (!element.isConnected) registry.elements.delete(ref);
    // Expired references fail safely instead of being assigned to another node.
    while (registry.elements.size > 5000)
      registry.elements.delete(registry.elements.keys().next().value!);
    const query =
      'a[href],button,summary,input:not([type="hidden"]),textarea,select,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="combobox"],[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]';
    const candidates = (scope.matches(query) ? [scope] : [])
      .concat(Array.from(scope.querySelectorAll(query)))
      .filter(visible);
    let nextRef = options.firstRef;
    let remainingOptions = 100;
    let optionsTruncated = false;
    const interactables = candidates
      .slice(0, options.maxControls)
      .map((element, index) => {
        let ref = registry.refs.get(element);
        if (!ref || !registry.elements.has(ref)) {
          ref = `@e${nextRef++}`;
          registry.refs.set(element, ref);
          registry.elements.set(ref, element);
        }
        const field = element as HTMLInputElement;
        const labels = field.labels
          ? Array.from(field.labels)
              .map((label) => label.innerText)
              .join(" ")
          : "";
        const labelledBy = (element.getAttribute("aria-labelledby") || "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ");
        const label = (
          element.getAttribute("aria-label") ||
          labelledBy.trim() ||
          labels ||
          element.getAttribute("placeholder") ||
          (element instanceof HTMLInputElement &&
          ["submit", "reset", "button"].includes(element.type)
            ? element.value ||
              (element.type === "submit"
                ? "Submit"
                : element.type === "reset"
                  ? "Reset"
                  : "")
            : element instanceof HTMLInputElement && element.type === "image"
              ? element.alt
              : element instanceof HTMLTextAreaElement ||
                  (element instanceof HTMLElement && element.isContentEditable)
                ? ""
                : element.textContent) ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim();
        const entry = {
          index,
          ref,
          tag: element.localName,
          role: element.getAttribute("role") || element.localName,
          type: element.getAttribute("type") || undefined,
          label: label.slice(0, options.mode === "compact" ? 80 : 200),
          selector: selectorFor(element),
          disabled:
            element.matches(":disabled") ||
            element.getAttribute("aria-disabled") === "true",
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
                  })),
                  ...(truncated ? { optionsTruncated: true } : {}),
                };
              })()
            : {}),
        };
        return entry;
      });
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
      truncated:
        text.length > options.maxChars ||
        candidates.length > options.maxControls ||
        optionsTruncated,
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
      if (matches.length !== 1 || !visible(matches[0]))
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
  if (operation === "scroll") {
    const direction = payload.direction as string;
    const pixels = payload.pixels as number;
    window.scrollBy({
      left: direction === "right" ? pixels : direction === "left" ? -pixels : 0,
      top: direction === "down" ? pixels : direction === "up" ? -pixels : 0,
      behavior: "instant",
    });
    return { ok: true, x: window.scrollX, y: window.scrollY };
  }
  const element = target();
  if (!(element instanceof Element)) return element;
  if (!(element instanceof HTMLElement))
    return failure("Element does not support this action.");
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
    return { ok: true };
  }
  if (operation === "target") {
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
    return { ok: true, x, y };
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
  return { ok: true };
}
