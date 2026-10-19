/**
 * =============================================================================
 * Company     : MKraft Capability Solutions LLP
 * Copyright   : Copyright (c) 2026 MKraft Capability Solutions LLP
 * Author      : Dhanraj Dadhich
 * Reviewed By : Dhanraj Dadhich
 * Description : Tiny ICU-style message formatter (no dependencies, React-free): {arg} placeholders, {n, plural, …} with
 *               Intl.PluralRules (=N exact matches, # = the formatted number), {x, select, …} and <tag>rich</tag> runs;
 *               plus Intl number/date/currency/list helpers bound to the active locale.
 * =============================================================================
 */
import { DEFAULT_LOCALE, findLocale, resolveIntlLocale } from './locales.js';

/** Locale code the site currently renders (kept in sync by LocaleProvider; read by non-React helpers). */
let activeCode = DEFAULT_LOCALE;

/** Record the locale the site renders (LocaleProvider calls this on every locale change).
 * @param {string} code - Locale code.
 * @returns {void} Stores it.
 */
export function setActiveLocale(code) {
  activeCode = findLocale(code) ? code : DEFAULT_LOCALE;
}

/** Code of the locale the site currently renders.
 * @returns {string} Locale code.
 */
export function activeLocale() {
  return activeCode;
}

/** Intl locale tag of a locale code (default: the active locale), e.g. "ar" → "ar-u-nu-latn"; falls back to the
 * registry's intlFallback when the runtime has no data for the locale (e.g. sat → en-IN).
 * @param {string} [code] - Locale code.
 * @returns {string} BCP 47 tag for Intl.
 */
export function intlLocale(code = activeCode) {
  return resolveIntlLocale(code);
}

const parsed = new Map();

/** Parse a message into nodes: strings, {type:'arg'}, {type:'plural'|'select'}, {type:'pound'} and {type:'tag'}.
 * @param {string} message - ICU-style message.
 * @returns {Array<string|object>} Nodes (cached per message).
 */
export function parseMessage(message) {
  const source = String(message ?? '');
  if (parsed.has(source)) return parsed.get(source);
  let index = 0;

  /** Parse nodes until a closing "}" (inside a branch) or "</name>" (inside a tag).
   * @param {boolean} inBranch - Inside a plural/select branch ("}" ends it).
   * @param {boolean} pound - Inside a plural branch ("#" is the number).
   * @param {string|null} closeTag - Tag name whose closing tag ends this run.
   * @returns {Array<string|object>} Nodes.
   */
  const nodes = (inBranch, pound, closeTag) => {
    const out = [];
    let text = '';
    /** Push pending text.
     * @returns {void} Flushes.
     */
    const flush = () => { if (text) { out.push(text); text = ''; } };
    while (index < source.length) {
      const char = source[index];
      if (char === '}' && inBranch) break;
      if (char === '#' && pound) { flush(); out.push({ type: 'pound' }); index++; continue; }
      if (char === '<') {
        const close = /^<\/([a-zA-Z][\w-]*)>/.exec(source.slice(index));
        if (close) {
          if (close[1] === closeTag) { index += close[0].length; flush(); return out; }
          text += close[0];
          index += close[0].length;
          continue;
        }
        const open = /^<([a-zA-Z][\w-]*)(\s*\/)?>/.exec(source.slice(index));
        if (open) {
          flush();
          index += open[0].length;
          out.push({ type: 'tag', name: open[1], children: open[2] ? [] : nodes(inBranch, pound, open[1]) });
          continue;
        }
      }
      if (char === '{') {
        const head = /^\{\s*([\w.]+)\s*(?:,\s*(plural|select|selectordinal)\s*,\s*)?/.exec(source.slice(index));
        if (head) {
          flush();
          index += head[0].length;
          if (!head[2]) {
            const end = source.indexOf('}', index);
            index = end < 0 ? source.length : end + 1;
            out.push({ type: 'arg', name: head[1] });
            continue;
          }
          const options = {};
          while (index < source.length) {
            const option = /^\s*(=?[\w-]+)\s*\{/.exec(source.slice(index));
            if (!option) break;
            index += option[0].length;
            options[option[1]] = nodes(true, head[2] !== 'select', null);
            index++;
          }
          const end = source.indexOf('}', index);
          index = end < 0 ? source.length : end + 1;
          out.push({ type: head[2] === 'select' ? 'select' : 'plural', ordinal: head[2] === 'selectordinal', name: head[1], options });
          continue;
        }
      }
      text += char;
      index++;
    }
    flush();
    return out;
  };

  const result = nodes(false, false, null);
  parsed.set(source, result);
  return result;
}

/** Format a number for display in a locale.
 * @param {number} value - Number.
 * @param {Intl.NumberFormatOptions} [options] - Intl options.
 * @param {string} [code] - Locale code (default: active).
 * @returns {string} Formatted number.
 */
export function formatNumber(value, options = {}, code) {
  return new Intl.NumberFormat(intlLocale(code), options).format(value);
}

/** Format a currency amount (e.g. formatCurrency(4900, 'INR')).
 * @param {number} value - Amount.
 * @param {string} currency - ISO 4217 code.
 * @param {Intl.NumberFormatOptions} [options] - Extra Intl options.
 * @param {string} [code] - Locale code (default: active).
 * @returns {string} Formatted amount.
 */
export function formatCurrency(value, currency, options = {}, code) {
  return new Intl.NumberFormat(intlLocale(code), { style: 'currency', currency, maximumFractionDigits: 0, ...options }).format(value);
}

/** Format a date/time.
 * @param {Date|string|number} value - Instant.
 * @param {Intl.DateTimeFormatOptions} [options] - Intl options (default: day month year).
 * @param {string} [code] - Locale code (default: active).
 * @returns {string} Formatted date.
 */
export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }, code) {
  return new Intl.DateTimeFormat(intlLocale(code), options).format(new Date(value));
}

/** Join items as a localized list ("A, B and C" / "A、B和C").
 * @param {string[]} items - Items.
 * @param {Intl.ListFormatOptions} [options] - Intl options.
 * @param {string} [code] - Locale code (default: active).
 * @returns {string} List.
 */
export function formatList(items, options = { type: 'conjunction' }, code) {
  return typeof Intl.ListFormat === 'function' ? new Intl.ListFormat(intlLocale(code), options).format(items) : items.join(', ');
}

/** Format parsed nodes into parts (strings and whatever renderTag returns).
 * @param {Array<string|object>} nodes - Parsed nodes.
 * @param {object} values - Placeholder values.
 * @param {string} code - Locale code.
 * @param {Function|null} renderTag - (name, children, key) → part; null renders tag children as plain text.
 * @param {number|null} number - Current plural value (for "#").
 * @returns {Array<any>} Parts.
 */
function formatNodes(nodes, values, code, renderTag, number) {
  const parts = [];
  nodes.forEach(/** Format one node.
   * @param {string|object} node - Node.
   * @param {number} position - Position (React key).
   * @returns {void} Pushes parts.
   */ (node, position) => {
    if (typeof node === 'string') { parts.push(node); return; }
    if (node.type === 'pound') { parts.push(number == null ? '#' : formatNumber(number, {}, code)); return; }
    if (node.type === 'arg') {
      const value = values?.[node.name];
      parts.push(value == null ? `{${node.name}}` : typeof value === 'number' ? formatNumber(value, {}, code) : value);
      return;
    }
    if (node.type === 'tag') {
      const children = formatNodes(node.children, values, code, renderTag, number);
      if (renderTag) parts.push(renderTag(node.name, children, `${node.name}-${position}`));
      else parts.push(...children);
      return;
    }
    const raw = values?.[node.name];
    let branch;
    if (node.type === 'select') branch = node.options[String(raw)] || node.options.other;
    else {
      const value = Number(raw);
      const category = new Intl.PluralRules(intlLocale(code), { type: node.ordinal ? 'ordinal' : 'cardinal' }).select(value);
      branch = node.options[`=${value}`] || node.options[category] || node.options.other;
    }
    if (branch) parts.push(...formatNodes(branch, values, code, renderTag, node.type === 'plural' ? Number(raw) : number));
  });
  return parts;
}

/** Format a message to a plain string (rich tags are dropped, their text kept).
 * @param {string} message - ICU-style message.
 * @param {object} [values] - Placeholder values.
 * @param {string} [code] - Locale code (default: active).
 * @returns {string} Text.
 */
export function formatMessage(message, values = {}, code = activeCode) {
  return formatNodes(parseMessage(message), values, code, null, null).join('');
}

/** Format a message keeping rich tags: each <tag>…</tag> becomes renderTag(name, children, key).
 * @param {string} message - ICU-style message.
 * @param {object} values - Placeholder values (may include React nodes).
 * @param {Function} renderTag - Tag renderer.
 * @param {string} [code] - Locale code (default: active).
 * @returns {Array<any>} Parts (strings and rendered tags).
 */
export function formatRich(message, values, renderTag, code = activeCode) {
  return formatNodes(parseMessage(message), values, code, renderTag, null);
}

/** Flatten a nested catalog into dot keys ({a: {b: 'x'}} → {'a.b': 'x'}).
 * @param {object} catalog - Nested catalog.
 * @param {string} [prefix] - Key prefix.
 * @param {object} [out] - Accumulator.
 * @returns {Record<string, string>} Flat catalog.
 */
export function flattenCatalog(catalog, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(catalog || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flattenCatalog(value, path, out);
    else out[path] = value;
  }
  return out;
}

/** Placeholder and tag names a message uses (for parity checks): "{name}", "<em>", plural argument names.
 * @param {string} message - Message.
 * @returns {string[]} Sorted, unique tokens.
 */
export function messageTokens(message) {
  const tokens = new Set();
  /** Walk nodes.
   * @param {Array<string|object>} list - Nodes.
   * @returns {void} Collects.
   */
  const walk = (list) => list.forEach(/** Collect one node.
   * @param {string|object} node - Node.
   * @returns {void} Adds tokens.
   */ (node) => {
    if (typeof node === 'string' || node.type === 'pound') return;
    if (node.type === 'tag') { tokens.add(`<${node.name}>`); walk(node.children); return; }
    tokens.add(`{${node.name}}`);
    if (node.options) Object.values(node.options).forEach(walk);
  });
  walk(parseMessage(message));
  return [...tokens].sort();
}
