/**
 * Architecture rules of the modular monolith (ADR 0001, 0002, 0003), checked in CI.
 * Run with `pnpm check:architecture`.
 */
module.exports = {
  forbidden: [
    {
      name: 'context-isolation',
      comment: 'A bounded context never imports another one: contexts only meet on the bus (ADR 0002).',
      severity: 'error',
      from: { path: '^contexts/([^/]+)/' },
      to: { path: '^contexts/', pathNot: '^contexts/$1/' },
    },
    {
      name: 'contexts-only-share-contracts',
      comment: 'Besides its own code, a context may only use the published language in packages/contracts (ADR 0003).',
      severity: 'error',
      from: { path: '^contexts/[^/]+/src/' },
      to: { path: '^(packages|apps|tests)/', pathNot: '^packages/contracts/' },
    },
    {
      name: 'domain-is-pure',
      comment: 'The domain depends on nothing but itself: no application, no infrastructure, no package.',
      severity: 'error',
      from: { path: '^contexts/([^/]+)/src/domain/' },
      to: { pathNot: '^contexts/$1/src/domain/' },
    },
    {
      name: 'application-ignores-infrastructure',
      comment: 'Use cases depend on ports, never on adapters (dependency inversion).',
      severity: 'error',
      from: { path: '^contexts/([^/]+)/src/application/' },
      to: { path: '^contexts/$1/src/infrastructure/' },
    },
    {
      name: 'public-entry-only',
      comment: 'Outside a context, only its src/index.ts may be imported.',
      severity: 'error',
      from: { pathNot: '^contexts/' },
      to: { path: '^contexts/[^/]+/src/', pathNot: '^contexts/[^/]+/src/index\\.ts$' },
    },
    {
      name: 'contracts-stand-alone',
      comment: 'The published language depends on no context, app or other package.',
      severity: 'error',
      from: { path: '^packages/contracts/' },
      to: { path: '^(contexts|apps|tests)/|^packages/(?!contracts/)' },
    },
    {
      name: 'nobody-imports-apps',
      comment: 'Apps are composition roots: they import the contexts, never the reverse.',
      severity: 'error',
      from: { pathNot: '^apps/' },
      to: { path: '^apps/' },
    },
    {
      name: 'src-ignores-tests',
      severity: 'error',
      from: { path: '/src/' },
      to: { path: '/test/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    // TypeScript 7 has no JS API yet: swc parses the sources, type-only imports included.
    parser: 'swc',
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)node_modules/' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
