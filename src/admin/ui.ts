// Small DOM helpers. Everything from the database is set as text, never as HTML.

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
    else if (k === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = Boolean(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element, ...children: Child[]) {
  el.replaceChildren();
  append(el, children);
}

let uid = 0;
/** A labelled form field. `input` is any control; its id is wired to the label. */
export function field(label: string, input: HTMLElement, hint?: string) {
  const id = input.id || `f${++uid}`;
  input.id = id;
  return h('div', { class: 'fld' },
    h('label', { for: id }, label),
    input,
    hint ? h('span', { class: 'hint' }, hint) : null,
  );
}

export const text = (value: unknown, attrs: Attrs = {}) =>
  h('input', { type: 'text', value: value ?? '', ...attrs });
export const num = (value: unknown, attrs: Attrs = {}) =>
  h('input', { type: 'text', inputmode: 'numeric', value: value ?? '', ...attrs });
export const check = (value: boolean, attrs: Attrs = {}) =>
  h('input', { type: 'checkbox', checked: value, ...attrs });
export const area = (value: unknown, attrs: Attrs = {}) => {
  const t = h('textarea', attrs);
  t.value = value == null ? '' : String(value);
  return t;
};
export function select(options: [string, string][], value: string | null, attrs: Attrs = {}) {
  const s = h('select', attrs, options.map(([v, l]) => h('option', { value: v }, l)));
  s.value = value ?? '';
  return s;
}

/** Status line under a form: shows success or the database's error. */
export function status() {
  const el = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  return Object.assign(el, {
    ok(msg: string) { el.className = 'status ok'; el.textContent = msg; },
    err(e: unknown) { el.className = 'status err'; el.textContent = e instanceof Error ? e.message : String(e); },
    info(msg: string) { el.className = 'status'; el.textContent = msg; },
  });
}

/** Runs an async action with the button disabled; errors go to the status line. */
export async function busy(btn: HTMLButtonElement, st: ReturnType<typeof status>, fn: () => Promise<string | void>) {
  btn.disabled = true;
  st.info('Saving…');
  try {
    const msg = await fn();
    st.ok(msg || 'Saved.');
  } catch (e) {
    st.err(e);
  } finally {
    btn.disabled = false;
  }
}

// ---- value parsing

/** '' -> null; '8,097,015' -> 8097015; '13M' -> 13000000; '1.5K' -> 1500. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/,/g, '').replace(/^≈\s*/, '');
  if (!t) return null;
  const m = t.match(/^(-?\d+(?:\.\d+)?)\s*([kKmMbB])?$/);
  if (!m) throw new Error(`"${s}" is not a number`);
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase() as 'k' | 'm' | 'b'] ?? 1;
  return Math.round(+m[1] * mult * 100) / 100;
}
export const isRounded = (s: string) => /\d\s*[kKmMbB]$/.test(s.trim());

export function parseInt0(s: string): number | null {
  const n = parseNum(s);
  if (n !== null && !Number.isInteger(n)) throw new Error(`"${s}" must be a whole number`);
  return n;
}

/** '143:02:53' -> 514973 seconds. */
export function parseTime(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const m = t.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (!m) throw new Error(`"${s}" is not a time like 143:02:53`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}
export function fmtTime(sec: number | null): string {
  if (sec == null) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(sec / 3600)}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}`;
}
export const fmtInt = (n: number | null) => (n == null ? '' : n.toLocaleString('en-US'));
export const blank = (s: string) => (s.trim() === '' ? null : s.trim());
