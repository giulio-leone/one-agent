import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'framework/index': 'src/framework/index.ts',
    'framework/api': 'src/framework/api.ts',
  },
  format: ['esm', 'cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: [
    // Self-referential subpath imports
    /^@giulio-leone\/one-agent/,
    // Peer / optional deps
    /^@giulio-leone\//,
    /^@prisma\//,
    /^@workflow\//,
    'workflow',
    /^workflow\//,
  ],
});
