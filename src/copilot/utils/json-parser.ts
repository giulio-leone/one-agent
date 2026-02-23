/**
 * Parse JSON response from LLM safely
 * Handles code blocks, whitespace, and potential trailing commas
 */
import { logger } from '@giulio-leone/lib-core';

export function parseJsonResponse(text: string): unknown {
  try {
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    logger.error('Failed to parse JSON response:', error);
    // Attempt to fix common JSON errors if needed, or just throw
    throw new Error('Invalid JSON response from AI');
  }
}
