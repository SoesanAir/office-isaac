/**
 * Declarative content schema validation.
 *
 * GDD refs: R-TEC-005 (content data validated at build and load time; invalid
 *           references, weights, sockets, tags and missing assets fail loudly in
 *           development), R-GOV-003 (content is data-driven), R-ITM-002
 *           (unique sprite, fixed class), 23.1 "Schema" test layer.
 *
 * Deliberately tiny and dependency-free. It reports *every* problem in one pass
 * with a path, because a validator that stops at the first error turns a content
 * batch review into an afternoon of whack-a-mole.
 */

/** Field type constructors. Each returns a plain descriptor object. */
export const t = {
  string: (opts = {}) => ({ kind: 'string', ...opts }),
  number: (opts = {}) => ({ kind: 'number', ...opts }),
  int: (opts = {}) => ({ kind: 'int', ...opts }),
  bool: (opts = {}) => ({ kind: 'bool', ...opts }),
  enum: (values, opts = {}) => ({ kind: 'enum', values: normaliseEnum(values), ...opts }),
  array: (of, opts = {}) => ({ kind: 'array', of, ...opts }),
  tuple: (items, opts = {}) => ({ kind: 'tuple', items, ...opts }),
  object: (fields, opts = {}) => ({ kind: 'object', fields, ...opts }),
  /** Free-form map with validated values. */
  map: (of, opts = {}) => ({ kind: 'map', of, ...opts }),
  /** Cross-reference to another content kind; checked in the link pass. */
  ref: (refKind, opts = {}) => ({ kind: 'ref', refKind, ...opts }),
  /** Anything goes. Use sparingly and only for behaviour parameter bags. */
  any: (opts = {}) => ({ kind: 'any', ...opts }),
  /** One of several shapes. */
  union: (options, opts = {}) => ({ kind: 'union', options, ...opts }),
  /** Function reference (behaviour hooks defined alongside data). */
  fn: (opts = {}) => ({ kind: 'fn', ...opts }),
};

function normaliseEnum(values) {
  if (Array.isArray(values)) return values;
  return Object.values(values);
}

/** Accumulates problems with dotted paths. */
export class Issues {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  error(path, message) {
    this.errors.push({ path, message });
  }

  warn(path, message) {
    this.warnings.push({ path, message });
  }

  get ok() {
    return this.errors.length === 0;
  }

  format() {
    const lines = [];
    for (const e of this.errors) lines.push(`  ERROR  ${e.path}: ${e.message}`);
    for (const w of this.warnings) lines.push(`  WARN   ${w.path}: ${w.message}`);
    return lines.join('\n');
  }

  merge(other) {
    this.errors.push(...other.errors);
    this.warnings.push(...other.warnings);
    return this;
  }
}

/**
 * Validate one value against one descriptor.
 * `refs` collects `{path, refKind, id}` for the later link pass.
 */
export function validateValue(value, desc, path, issues, refs) {
  if (value === undefined || value === null) {
    if (desc.required) issues.error(path, 'required field is missing');
    return;
  }

  switch (desc.kind) {
    case 'any':
      return;

    case 'fn':
      if (typeof value !== 'function') issues.error(path, `expected function, got ${typeOf(value)}`);
      return;

    case 'string': {
      if (typeof value !== 'string') {
        issues.error(path, `expected string, got ${typeOf(value)}`);
        return;
      }
      if (desc.pattern && !desc.pattern.test(value)) {
        issues.error(path, `"${value}" does not match ${desc.pattern}`);
      }
      if (desc.minLength !== undefined && value.length < desc.minLength) {
        issues.error(path, `string shorter than ${desc.minLength}`);
      }
      if (desc.maxLength !== undefined && value.length > desc.maxLength) {
        issues.error(path, `string longer than ${desc.maxLength}`);
      }
      return;
    }

    case 'number':
    case 'int': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.error(path, `expected finite number, got ${typeOf(value)}`);
        return;
      }
      if (desc.kind === 'int' && !Number.isInteger(value)) {
        issues.error(path, `expected integer, got ${value}`);
      }
      if (desc.min !== undefined && value < desc.min) {
        issues.error(path, `${value} is below minimum ${desc.min}`);
      }
      if (desc.max !== undefined && value > desc.max) {
        issues.error(path, `${value} is above maximum ${desc.max}`);
      }
      return;
    }

    case 'bool':
      if (typeof value !== 'boolean') issues.error(path, `expected boolean, got ${typeOf(value)}`);
      return;

    case 'enum':
      if (!desc.values.includes(value)) {
        issues.error(path, `"${value}" is not one of [${desc.values.join(', ')}]`);
      }
      return;

    case 'array': {
      if (!Array.isArray(value)) {
        issues.error(path, `expected array, got ${typeOf(value)}`);
        return;
      }
      if (desc.minItems !== undefined && value.length < desc.minItems) {
        issues.error(path, `expected at least ${desc.minItems} items, got ${value.length}`);
      }
      if (desc.maxItems !== undefined && value.length > desc.maxItems) {
        issues.error(path, `expected at most ${desc.maxItems} items, got ${value.length}`);
      }
      if (desc.unique) {
        const seen = new Set();
        for (const item of value) {
          const key = typeof item === 'object' ? JSON.stringify(item) : String(item);
          if (seen.has(key)) issues.error(path, `duplicate entry ${key}`);
          seen.add(key);
        }
      }
      for (let i = 0; i < value.length; i += 1) {
        validateValue(value[i], desc.of, `${path}[${i}]`, issues, refs);
      }
      return;
    }

    case 'tuple': {
      if (!Array.isArray(value)) {
        issues.error(path, `expected tuple array, got ${typeOf(value)}`);
        return;
      }
      if (value.length !== desc.items.length) {
        issues.error(path, `expected ${desc.items.length} elements, got ${value.length}`);
      }
      for (let i = 0; i < desc.items.length; i += 1) {
        validateValue(value[i], desc.items[i], `${path}[${i}]`, issues, refs);
      }
      return;
    }

    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        issues.error(path, `expected object, got ${typeOf(value)}`);
        return;
      }
      validateFields(value, desc.fields, path, issues, refs, desc.allowUnknown);
      return;
    }

    case 'map': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        issues.error(path, `expected object map, got ${typeOf(value)}`);
        return;
      }
      for (const [key, entry] of Object.entries(value)) {
        if (desc.keyPattern && !desc.keyPattern.test(key)) {
          issues.error(`${path}.${key}`, `key does not match ${desc.keyPattern}`);
        }
        validateValue(entry, desc.of, `${path}.${key}`, issues, refs);
      }
      return;
    }

    case 'ref': {
      if (typeof value !== 'string') {
        issues.error(path, `expected ${desc.refKind} id string, got ${typeOf(value)}`);
        return;
      }
      refs.push({ path, refKind: desc.refKind, id: value });
      return;
    }

    case 'union': {
      const attempts = desc.options.map((option) => {
        const sub = new Issues();
        validateValue(value, option, path, sub, []);
        return sub;
      });
      if (!attempts.some((a) => a.ok)) {
        issues.error(path, `value matched none of ${desc.options.length} allowed shapes`);
      }
      return;
    }

    default:
      issues.error(path, `unknown schema kind "${desc.kind}"`);
  }
}

function validateFields(value, fields, path, issues, refs, allowUnknown = false) {
  for (const [key, desc] of Object.entries(fields)) {
    const childPath = path ? `${path}.${key}` : key;
    validateValue(value[key], desc, childPath, issues, refs);
  }
  if (!allowUnknown) {
    for (const key of Object.keys(value)) {
      if (!(key in fields)) {
        issues.warn(path ? `${path}.${key}` : key, 'unknown field (typo?)');
      }
    }
  }
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * A named schema for one content kind.
 */
export class Schema {
  /**
   * @param {string} kind e.g. 'weapon'
   * @param {object} fields field descriptors
   * @param {{idPattern?: RegExp, allowUnknown?: boolean, invariants?: Array<(def, issues)=>void>}} opts
   */
  constructor(kind, fields, opts = {}) {
    this.kind = kind;
    this.fields = fields;
    this.idPattern = opts.idPattern;
    this.allowUnknown = opts.allowUnknown ?? false;
    /** Cross-field checks that a field-by-field validator cannot express. */
    this.invariants = opts.invariants || [];
  }

  /**
   * @returns {{issues: Issues, refs: Array<{path:string,refKind:string,id:string}>}}
   */
  validate(def) {
    const issues = new Issues();
    const refs = [];
    if (typeof def !== 'object' || def === null) {
      issues.error(this.kind, `definition is ${typeOf(def)}, expected object`);
      return { issues, refs };
    }
    const label = `${this.kind}:${def.id ?? '<no id>'}`;
    if (this.idPattern && !this.idPattern.test(def.id ?? '')) {
      issues.error(`${label}.id`, `id must match ${this.idPattern}`);
    }
    validateFields(def, this.fields, label, issues, refs, this.allowUnknown);
    for (const invariant of this.invariants) {
      invariant(def, issues, label);
    }
    return { issues, refs };
  }
}
