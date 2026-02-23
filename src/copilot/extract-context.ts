/**
 * Estrae informazioni contestuali (giorno, settimana) dal messaggio usando AI
 * per maggiore flessibilità rispetto alle regex
 */

import { z } from 'zod';
import { generateText, Output } from 'ai';
import { getModelByTier, createCustomModel } from './utils/model-factory';
import { AIProviderConfigService } from '@giulio-leone/lib-ai';
import type { ProviderName } from '@giulio-leone/lib-ai';
import { TOKEN_LIMITS } from '@giulio-leone/constants';

interface ExtractionContext {
  message: string;
  contextType: 'nutrition' | 'workout';
  totalDays?: number;
  totalWeeks?: number;
}

interface ExtractionResult {
  dayNumber?: number | null;
  weekNumber?: number | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Estrae giorno e/o settimana dal messaggio usando AI
 */
export async function extractContextFromMessage(
  context: ExtractionContext
): Promise<ExtractionResult> {
  const { message, contextType, totalDays, totalWeeks } = context;

  // Usa un modello veloce per l'estrazione
  const modelConfig = getModelByTier('fast');
  const apiKey = await AIProviderConfigService.getApiKey(modelConfig.provider as ProviderName);

  if (!apiKey) {
    // Fallback se non c'è API key
    return {
      dayNumber: null,
      weekNumber: null,
      confidence: 'low',
    };
  }

  // Use centralized model creation with custom config
  const model = await createCustomModel(
    modelConfig,
    {
      maxTokens: TOKEN_LIMITS.DEFAULT_MAX_TOKENS,
      temperature: 0.1,
    },
    apiKey
  );

  const prompt = `Analizza il seguente messaggio dell'utente e estrai il numero del giorno e/o della settimana menzionati.

Contesto:
- Tipo: ${contextType === 'nutrition' ? 'Piano nutrizionale' : 'Programma di allenamento'}
${totalDays ? `- Totale giorni disponibili: ${totalDays}` : ''}
${totalWeeks ? `- Totale settimane disponibili: ${totalWeeks}` : ''}

Messaggio dell'utente:
"${message}"

Istruzioni:
1. Cerca riferimenti espliciti a giorni (es: "giorno 1", "primo giorno", "nel giorno 3", "day 2")
2. Cerca riferimenti espliciti a settimane (es: "settimana 1", "prima settimana", "nella settimana 2", "week 3")
3. Se il contesto è nutrizione, cerca solo il giorno
4. Se il contesto è workout, cerca settimana e possibilmente giorno
5. Se non trovi riferimenti chiari, restituisci null
6. Valuta la confidenza: "high" se il riferimento è esplicito, "medium" se è implicito ma chiaro, "low" se è ambiguo

Rispondi SOLO con un oggetto JSON valido nel formato:
{
  "dayNumber": <number o null>,
  "weekNumber": <number o null>,
  "confidence": "high" | "medium" | "low"
}`;

  try {
    const extractionSchema = z.object({
      dayNumber: z.number().int().positive().nullable(),
      weekNumber: z.number().int().positive().nullable(),
      confidence: z.enum(['high', 'medium', 'low']),
    });

    // Use generateText with Output.object() (AI SDK 6) for structured output
    const result = await generateText({
      model,
      prompt,
      output: Output.object({ schema: extractionSchema }),
      temperature: 0.1, // Bassa temperatura per risultati più deterministici
    } as Parameters<typeof generateText>[0]);

    const extracted = result.output as ExtractionResult;

    // Valida i valori estratti
    if (extracted.dayNumber !== null && extracted.dayNumber !== undefined) {
      if (extracted.dayNumber < 1 || (totalDays && extracted.dayNumber > totalDays)) {
        return { dayNumber: null, weekNumber: extracted.weekNumber ?? null, confidence: 'low' };
      }
    }

    if (extracted.weekNumber !== null && extracted.weekNumber !== undefined) {
      if (extracted.weekNumber < 1 || (totalWeeks && extracted.weekNumber > totalWeeks)) {
        return { dayNumber: extracted.dayNumber ?? null, weekNumber: null, confidence: 'low' };
      }
    }

    return extracted;
  } catch (_error: unknown) {
    // Fallback: restituisci null se l'estrazione fallisce
    return {
      dayNumber: null,
      weekNumber: null,
      confidence: 'low',
    };
  }
}

/**
 * Estrae solo il numero del giorno (versione semplificata per nutrition)
 */
export async function extractDayNumber(
  message: string,
  totalDays?: number
): Promise<number | null> {
  const result = await extractContextFromMessage({
    message,
    contextType: 'nutrition',
    totalDays,
  });

  // Se la confidenza è bassa, restituisci null
  if (result.confidence === 'low') {
    return null;
  }

  return result.dayNumber ?? null;
}

/**
 * Estrae settimana e giorno (versione per workout)
 */
export async function extractWeekAndDay(
  message: string,
  totalWeeks?: number,
  totalDays?: number
): Promise<{ weekNumber: number | null; dayNumber: number | null }> {
  const result = await extractContextFromMessage({
    message,
    contextType: 'workout',
    totalWeeks,
    totalDays,
  });

  // Se la confidenza è bassa, restituisci null
  if (result.confidence === 'low') {
    return { weekNumber: null, dayNumber: null };
  }

  return {
    weekNumber: result.weekNumber ?? null,
    dayNumber: result.dayNumber ?? null,
  };
}
