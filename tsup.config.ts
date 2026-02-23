import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'framework/index': 'src/framework/index.ts',
    'framework/api': 'src/framework/api.ts',
    'chat/index': 'src/chat/index.ts',
    'chat/client': 'src/chat/client.ts',
    'chat/types': 'src/chat/types/index.ts',
    'chat/hooks': 'src/chat/hooks/index.ts',
    'chat/components': 'src/chat/components/index.ts',
    'chat/utils': 'src/chat/utils/index.ts',
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
    // React (for chat UI components)
    'react',
    'react-dom',
    'react/jsx-runtime',
    /^@ai-sdk\//,
    'ai',
    /^lucide-react/,
    /^next/,
    /^react-markdown/,
    /^remark-/,
    /^rehype-/,
    /^react-syntax-highlighter/,
  ],
});
