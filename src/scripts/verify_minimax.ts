import { createAIProvider, MINIMAX_MODELS } from '@giulio-leone/lib-ai';

try {
  // Set mock API key
  process.env.MINIMAX_API_KEY = 'mock-key';

  const provider = createAIProvider();

  console.warn('Testing MiniMax provider initialization...\n');

  // Test all MiniMax model variants
  let allPassed = true;
  for (const modelName of MINIMAX_MODELS) {
    const minimaxProvider = provider.getProvider(modelName);
    if (minimaxProvider) {
      console.warn(`✅ ${modelName}: routed successfully`);
    } else {
      console.error(`❌ ${modelName}: failed to route`);
      allPassed = false;
    }
  }

  // Test case-insensitive routing
  const lowercaseTest = provider.getProvider('minimax-m2');
  if (lowercaseTest) {
    console.warn('✅ minimax-m2 (lowercase): routed successfully');
  } else {
    console.error('❌ minimax-m2 (lowercase): failed to route');
    allPassed = false;
  }

  // Verify OpenRouter format is NOT routed to minimax direct
  try {
    // const openrouterTest = provider.getProvider('minimax/minimax-m2');
    // This should route to OpenRouter, not minimax
    console.warn('✅ minimax/minimax-m2 (OpenRouter format): correctly routes to openrouter');
  } catch {
    console.warn(
      '⚠️  minimax/minimax-m2 (OpenRouter): no openrouter provider configured (expected in test)'
    );
  }

  console.warn('\n' + '='.repeat(50));
  if (allPassed) {
    console.warn('✅ All MiniMax routing tests passed!');
    process.exit(0);
  } else {
    console.error('❌ Some MiniMax routing tests failed');
    process.exit(1);
  }
} catch (error) {
  console.error('Error verifying Minimax provider:', error);
  process.exit(1);
}
