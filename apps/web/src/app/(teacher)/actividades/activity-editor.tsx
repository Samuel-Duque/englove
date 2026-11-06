'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActivityType,
  ActivityStatus,
  Level,
  ActivityEditor,
  GamePublicConfig,
  GameAnswerKey,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { GameRenderer } from '../../../components/activities/GameRenderer';

interface ActivityEditorProps {
  initialActivity?: ActivityEditor;
}

type GameMechanicType = 'match' | 'order_words' | 'drag_drop' | 'memory' | 'timed_choice';

function asRecord(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return null;
}

function getStringProp(obj: unknown, key: string, fallback = ''): string {
  const rec = asRecord(obj);
  if (rec && typeof rec[key] === 'string') return rec[key] as string;
  if (rec && typeof rec[key] === 'number') return String(rec[key]);
  return fallback;
}

export interface FormSentenceItem {
  prompt: string;
  option1: string;
  option2: string;
  correctOption: 'opt1' | 'opt2';
  weight?: string;
}

function parseInitialFillBlankItems(cfg: unknown, ak: unknown): FormSentenceItem[] {
  const rec = asRecord(cfg);
  if (rec && Array.isArray(rec['items']) && rec['items'].length > 0) {
    const akRec = asRecord(ak);
    const akItems =
      akRec && asRecord(akRec['items']) ? (akRec['items'] as Record<string, unknown>) : {};

    const items: FormSentenceItem[] = [];
    for (const rawItem of rec['items']) {
      const item = asRecord(rawItem);
      if (!item) continue;
      const itemId = typeof item['id'] === 'string' ? item['id'] : '';
      const prompt = typeof item['prompt'] === 'string' ? item['prompt'] : '';
      let opt1 = 'cat';
      let opt2 = 'dog';
      let correct: 'opt1' | 'opt2' = 'opt1';

      if (Array.isArray(item['blanks']) && item['blanks'].length > 0) {
        const blank = asRecord(item['blanks'][0]);
        if (blank) {
          const blankId = typeof blank['id'] === 'string' ? blank['id'] : '';
          if (Array.isArray(blank['options'])) {
            const o1 = asRecord(blank['options'][0]);
            const o2 = asRecord(blank['options'][1]);
            if (o1 && typeof o1['text'] === 'string') opt1 = o1['text'];
            if (o2 && typeof o2['text'] === 'string') opt2 = o2['text'];

            const itemSol = akItems[itemId] ? asRecord(akItems[itemId]) : null;
            const correctOptId =
              itemSol && typeof itemSol[blankId] === 'string' ? itemSol[blankId] : null;
            if (o2 && correctOptId === o2['id']) {
              correct = 'opt2';
            }
          }
        }
      }

      items.push({
        prompt,
        option1: opt1,
        option2: opt2,
        correctOption: correct,
      });
    }

    if (items.length > 0) return items;
  }

  return [
    {
      prompt: 'The {{blank1}} is sleeping.',
      option1: 'cat',
      option2: 'dog',
      correctOption: 'opt1',
    },
  ];
}

function parseInitialExamItems(cfg: unknown, ak: unknown): FormSentenceItem[] {
  const rec = asRecord(cfg);
  if (rec && Array.isArray(rec['items']) && rec['items'].length > 0) {
    const akRec = asRecord(ak);
    const akItems =
      akRec && asRecord(akRec['items']) ? (akRec['items'] as Record<string, unknown>) : {};

    const items: FormSentenceItem[] = [];
    for (const rawItem of rec['items']) {
      const item = asRecord(rawItem);
      if (!item) continue;
      const itemId = typeof item['id'] === 'string' ? item['id'] : '';
      const prompt = typeof item['prompt'] === 'string' ? item['prompt'] : '';
      const weight = typeof item['weight'] === 'number' ? String(item['weight']) : '50';
      let opt1 = 'goes';
      let opt2 = 'go';
      let correct: 'opt1' | 'opt2' = 'opt1';

      if (Array.isArray(item['blanks']) && item['blanks'].length > 0) {
        const blank = asRecord(item['blanks'][0]);
        if (blank) {
          const blankId = typeof blank['id'] === 'string' ? blank['id'] : '';
          if (Array.isArray(blank['options'])) {
            const o1 = asRecord(blank['options'][0]);
            const o2 = asRecord(blank['options'][1]);
            if (o1 && typeof o1['text'] === 'string') opt1 = o1['text'];
            if (o2 && typeof o2['text'] === 'string') opt2 = o2['text'];

            const itemSol = akItems[itemId] ? asRecord(akItems[itemId]) : null;
            const correctOptId =
              itemSol && typeof itemSol[blankId] === 'string' ? itemSol[blankId] : null;
            if (o2 && correctOptId === o2['id']) {
              correct = 'opt2';
            }
          }
        }
      }

      items.push({
        prompt,
        option1: opt1,
        option2: opt2,
        correctOption: correct,
        weight,
      });
    }

    if (items.length > 0) return items;
  }

  return [
    {
      prompt: 'The {{blank1}} is sleeping.',
      option1: 'cat',
      option2: 'dog',
      correctOption: 'opt1',
      weight: '50',
    },
    {
      prompt: 'She {{blank1}} to school.',
      option1: 'goes',
      option2: 'go',
      correctOption: 'opt1',
      weight: '50',
    },
  ];
}

function balanceExamWeights(items: FormSentenceItem[]): FormSentenceItem[] {
  if (items.length === 0) return items;
  const count = items.length;
  const base = Math.floor((100 / count) * 10) / 10;
  let running = 0;
  return items.map((item, idx) => {
    if (idx === count - 1) {
      const lastWeight = Number((100 - running).toFixed(1));
      return { ...item, weight: String(lastWeight) };
    }
    running = Number((running + base).toFixed(1));
    return { ...item, weight: String(base) };
  });
}


function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseInitialMatchPairs(
  cfg: unknown,
  ak: unknown,
): Array<{ leftText: string; rightText: string }> {
  const rec = asRecord(cfg);
  if (rec && rec['mechanic'] === 'match') {
    const settings = asRecord(rec['settings']);
    if (settings && Array.isArray(settings['left']) && Array.isArray(settings['right'])) {
      const left = settings['left'] as Array<{ id: string; text: string }>;
      const right = settings['right'] as Array<{ id: string; text: string }>;
      const akRec = asRecord(ak);
      const sol = akRec ? asRecord(akRec['solution']) : null;
      const pairs = sol && asRecord(sol['pairs']) ? (sol['pairs'] as Record<string, string>) : {};
      const rightMap = new Map(right.map((r) => [r.id, r.text]));
      const parsed = left.map((l) => {
        const rightId = pairs[l.id];
        const rightText = rightId ? rightMap.get(rightId) ?? '' : '';
        return {
          leftText: l.text,
          rightText,
        };
      });
      if (parsed.length >= 2) return parsed;
    }
  }
  return [
    { leftText: 'Apple', rightText: 'Manzana' },
    { leftText: 'Cat', rightText: 'Gato' },
  ];
}

function parseInitialOrderWords(cfg: unknown): string {
  const rec = asRecord(cfg);
  if (rec && rec['mechanic'] === 'order_words') {
    const settings = asRecord(rec['settings']);
    if (settings && Array.isArray(settings['tokens'])) {
      const words = (settings['tokens'] as Array<{ text: string }>).map((t) => t.text);
      if (words.length > 0) return words.join(' ');
    }
  }
  return 'I like learning English';
}

function parseInitialDragDrop(
  cfg: unknown,
  ak: unknown,
): {
  targets: Array<{ name: string }>;
  objects: Array<{ text: string; targetIndex: number }>;
} {
  const rec = asRecord(cfg);
  if (rec && rec['mechanic'] === 'drag_drop') {
    const settings = asRecord(rec['settings']);
    if (settings && Array.isArray(settings['targets']) && Array.isArray(settings['objects'])) {
      const targets = settings['targets'] as Array<{ id: string; text: string }>;
      const objects = settings['objects'] as Array<{ id: string; text: string }>;
      const akRec = asRecord(ak);
      const sol = akRec ? asRecord(akRec['solution']) : null;
      const placements =
        sol && asRecord(sol['placements']) ? (sol['placements'] as Record<string, string>) : {};
      const targetIndexMap = new Map(targets.map((t, i) => [t.id, i]));
      const parsedTargets = targets.map((t) => ({ name: t.text }));
      const parsedObjects = objects.map((o) => {
        const targetId = placements[o.id];
        const targetIndex = targetId ? targetIndexMap.get(targetId) ?? 0 : 0;
        return {
          text: o.text,
          targetIndex,
        };
      });
      if (parsedTargets.length >= 2 && parsedObjects.length >= 2) {
        return { targets: parsedTargets, objects: parsedObjects };
      }
    }
  }
  return {
    targets: [{ name: 'Frutas' }, { name: 'Animales' }],
    objects: [
      { text: 'Apple', targetIndex: 0 },
      { text: 'Dog', targetIndex: 1 },
    ],
  };
}

function parseInitialMemory(
  cfg: unknown,
  ak: unknown,
): Array<{ card1Text: string; card2Text: string }> {
  const rec = asRecord(cfg);
  if (rec && rec['mechanic'] === 'memory') {
    const settings = asRecord(rec['settings']);
    if (settings && Array.isArray(settings['cards'])) {
      const cards = settings['cards'] as Array<{ id: string; text: string }>;
      const cardMap = new Map(cards.map((c) => [c.id, c.text]));
      const akRec = asRecord(ak);
      const sol = akRec ? asRecord(akRec['solution']) : null;
      if (sol && Array.isArray(sol['pairs'])) {
        const pairs = sol['pairs'] as Array<[string, string]>;
        const parsed = pairs.map(([c1, c2]) => ({
          card1Text: (c1 && cardMap.get(c1)) || '',
          card2Text: (c2 && cardMap.get(c2)) || '',
        }));
        if (parsed.length >= 2) return parsed;
      }
    }
  }
  return [
    { card1Text: 'Dog', card2Text: 'Perro' },
    { card1Text: 'Cat', card2Text: 'Gato' },
  ];
}

function parseInitialTimedChoice(
  cfg: unknown,
  ak: unknown,
): {
  timeLimit: string;
  questions: Array<{ prompt: string; opt1: string; opt2: string; correct: 'opt1' | 'opt2' }>;
} {
  const rec = asRecord(cfg);
  if (rec && rec['mechanic'] === 'timed_choice') {
    const settings = asRecord(rec['settings']);
    if (settings && Array.isArray(settings['questions'])) {
      const questions = settings['questions'] as Array<{
        id: string;
        prompt: string;
        options: Array<{ id: string; text: string }>;
      }>;
      const akRec = asRecord(ak);
      const sol = akRec ? asRecord(akRec['solution']) : null;
      const choices =
        sol && asRecord(sol['choices']) ? (sol['choices'] as Record<string, string>) : {};
      const parsed = questions.map((q) => {
        const opt1 = q.options[0]?.text || 'Opción 1';
        const opt2 = q.options[1]?.text || 'Opción 2';
        const correctOptId = choices[q.id];
        const correct = correctOptId === q.options[1]?.id ? ('opt2' as const) : ('opt1' as const);
        return {
          prompt: q.prompt,
          opt1,
          opt2,
          correct,
        };
      });
      const limit =
        typeof settings['timeLimitSeconds'] === 'number'
          ? String(settings['timeLimitSeconds'])
          : '20';
      if (parsed.length >= 1) return { timeLimit: limit, questions: parsed };
    }
  }
  return {
    timeLimit: '20',
    questions: [
      {
        prompt: 'What color is the sun?',
        opt1: 'Yellow',
        opt2: 'Blue',
        correct: 'opt1',
      },
    ],
  };
}

export function ActivityEditorComponent({ initialActivity }: ActivityEditorProps) {
  const router = useRouter();
  const isEditing = Boolean(initialActivity?.id);
  const initialCfg = initialActivity?.config;
  const initialAk = initialActivity?.answerKey;
  const initialMechanic = getStringProp(initialCfg, 'mechanic', 'match') as GameMechanicType;

  // Core metadata
  const [title, setTitle] = useState(initialActivity?.title ?? '');
  const [level, setLevel] = useState<Level>(initialActivity?.level ?? Level.A1);
  const [type, setType] = useState<ActivityType>(
    initialActivity?.type ?? ActivityType.fill_blank,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'kids' | 'teens'>('kids');
  const [gameMechanic, setGameMechanic] = useState<GameMechanicType>(
    initialActivity?.type === ActivityType.game ? initialMechanic : 'order_words',
  );

  // Durations
  const [expectedDuration, setExpectedDuration] = useState<string>(
    initialActivity?.expectedDurationSeconds?.toString() ?? '',
  );
  const [minPlausible, setMinPlausible] = useState<string>(
    initialActivity?.minPlausibleSeconds?.toString() ?? '',
  );

  // Type-specific state
  // Fill Blank / Exam
  const [fbInstructions, setFbInstructions] = useState(
    getStringProp(initialCfg, 'instructions', ''),
  );
  const [fbItems, setFbItems] = useState<FormSentenceItem[]>(() =>
    parseInitialFillBlankItems(initialCfg, initialAk),
  );
  const [examItems, setExamItems] = useState<FormSentenceItem[]>(() =>
    parseInitialExamItems(initialCfg, initialAk),
  );

  // Open Question (RFC-01: multi-pregunta abierta)
  interface OqQuestionItem {
    id: string;
    prompt: string;
    rubric: string;
    maxLength: string;
  }
  const [oqInstructions, setOqInstructions] = useState(
    getStringProp(initialCfg, 'instructions', ''),
  );
  const [oqQuestions, setOqQuestions] = useState<OqQuestionItem[]>(() => {
    if (initialCfg && typeof initialCfg === 'object' && Array.isArray((initialCfg as { items?: unknown[] }).items)) {
      const items = (initialCfg as { items: Array<Record<string, unknown>> }).items;
      if (items.length > 0) {
        return items.map((it) => ({
          id: typeof it.id === 'string' ? it.id : crypto.randomUUID(),
          prompt: typeof it.prompt === 'string' ? it.prompt : '',
          rubric: typeof it.rubric === 'string' ? it.rubric : '',
          maxLength: it.maxLength ? String(it.maxLength) : '2000',
        }));
      }
    }
    return [
      {
        id: crypto.randomUUID(),
        prompt: getStringProp(initialCfg, 'prompt', 'Describe your best friend and what you like doing together.'),
        rubric: getStringProp(initialCfg, 'rubric', 'Grammar, vocabulary, and coherence.'),
        maxLength: getStringProp(initialCfg, 'maxLength', '2000'),
      },
    ];
  });

  // Speaking
  const [spPrompt, setSpPrompt] = useState(
    getStringProp(
      initialCfg,
      'prompt',
      'Introduce yourself in 30 seconds: say your name, age, and favorite hobby.',
    ),
  );
  const [spExampleUrl, setSpExampleUrl] = useState(
    getStringProp(initialCfg, 'exampleUrl', ''),
  );
  const [spMaxDuration, setSpMaxDuration] = useState(
    getStringProp(initialCfg, 'maxDurationSeconds', '60'),
  );

  // Game mechanics states
  // 1. Order words
  const [orderWordsText, setOrderWordsText] = useState(() =>
    parseInitialOrderWords(initialCfg),
  );

  // 2. Match
  const [matchPairs, setMatchPairs] = useState(() =>
    parseInitialMatchPairs(initialCfg, initialAk),
  );

  // 3. Drag and Drop
  const initialDd = parseInitialDragDrop(initialCfg, initialAk);
  const [dragTargets, setDragTargets] = useState(initialDd.targets);
  const [dragObjects, setDragObjects] = useState(initialDd.objects);

  // 4. Memory
  const [memoryPairs, setMemoryPairs] = useState(() =>
    parseInitialMemory(initialCfg, initialAk),
  );

  // 5. Timed choice
  const initialTc = parseInitialTimedChoice(initialCfg, initialAk);
  const [timedChoiceLimit, setTimedChoiceLimit] = useState(initialTc.timeLimit);
  const [timedQuestions, setTimedQuestions] = useState(initialTc.questions);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [weightsAdjustedNotice, setWeightsAdjustedNotice] = useState(false);

  // Helper to build canonical config and answerKey
  const buildPayload = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new Error('El título de la actividad es obligatorio');
    }

    const expDur = expectedDuration.trim() ? parseInt(expectedDuration, 10) : null;
    const minPlaus = minPlausible.trim() ? parseInt(minPlausible, 10) : null;

    let config: unknown;
    let answerKey: unknown = null;

    if (type === ActivityType.fill_blank) {
      if (fbItems.length < 1) {
        throw new Error('La actividad debe tener al menos 1 oración');
      }

      const itemsPayload: Array<{
        id: string;
        prompt: string;
        blanks: Array<{
          id: string;
          options: Array<{ id: string; text: string }>;
        }>;
      }> = [];

      const answerKeyItems: Record<string, Record<string, string>> = {};

      for (const [idx, item] of fbItems.entries()) {
        if (!item.prompt.trim()) {
          throw new Error(`La oración ${idx + 1} no puede tener texto vacío`);
        }
        if (!item.option1.trim() || !item.option2.trim()) {
          throw new Error(`Las opciones de la oración ${idx + 1} no pueden estar vacías`);
        }
        if (item.option1.trim().toLowerCase() === item.option2.trim().toLowerCase()) {
          throw new Error(`Las opciones de la oración ${idx + 1} deben ser diferentes entre sí`);
        }

        const itemId = generateUuid();
        const blankId = generateUuid();
        const opt1Id = generateUuid();
        const opt2Id = generateUuid();

        let promptWithMarker = item.prompt.trim();
        if (/\{\{[^}]+\}\}/.test(promptWithMarker)) {
          let replaced = false;
          promptWithMarker = promptWithMarker.replace(/\{\{[^}]+\}\}/g, () => {
            if (!replaced) {
              replaced = true;
              return `{{${blankId}}}`;
            }
            return '';
          });
        } else {
          promptWithMarker = `${promptWithMarker} {{${blankId}}}`;
        }

        itemsPayload.push({
          id: itemId,
          prompt: promptWithMarker,
          blanks: [
            {
              id: blankId,
              options: [
                { id: opt1Id, text: item.option1.trim() },
                { id: opt2Id, text: item.option2.trim() },
              ],
            },
          ],
        });

        answerKeyItems[itemId] = {
          [blankId]: item.correctOption === 'opt1' ? opt1Id : opt2Id,
        };
      }

      config = {
        instructions: fbInstructions.trim() || undefined,
        items: itemsPayload,
      };

      answerKey = {
        items: answerKeyItems,
      };
    } else if (type === ActivityType.open_question) {
      if (oqQuestions.length === 0) {
        setError('Debes agregar al menos una pregunta abierta');
        setIsSaving(false);
        return;
      }
      for (let i = 0; i < oqQuestions.length; i++) {
        const q = oqQuestions[i];
        if (!q || !q.prompt.trim()) {
          setError(`La pregunta ${i + 1} no puede estar vacía`);
          setIsSaving(false);
          return;
        }
      }
      const firstQ = oqQuestions[0];
      if (!firstQ) {
        setError('Debes agregar al menos una pregunta abierta');
        setIsSaving(false);
        return;
      }

      config = {
        instructions: oqInstructions.trim() || undefined,
        items: oqQuestions.map((q) => ({
          id: q.id,
          prompt: q.prompt.trim(),
          rubric: q.rubric.trim() || undefined,
          maxLength: q.maxLength ? parseInt(q.maxLength, 10) : 2000,
        })),
        prompt: firstQ.prompt.trim(),
        rubric: firstQ.rubric.trim() || undefined,
        maxLength: firstQ.maxLength ? parseInt(firstQ.maxLength, 10) : 2000,
      };
      answerKey = null;
    } else if (type === ActivityType.speaking) {
      config = {
        prompt: spPrompt.trim(),
        exampleUrl: spExampleUrl.trim() || undefined,
        minDurationSeconds: 2, // Fixed 2s per RF-5
        maxDurationSeconds: spMaxDuration ? parseInt(spMaxDuration, 10) : 60,
      };
      answerKey = null;
    } else if (type === ActivityType.exam) {
      if (examItems.length < 1) {
        throw new Error('El examen debe tener al menos 1 oración');
      }

      const itemsPayload: Array<{
        id: string;
        weight: number;
        prompt: string;
        blanks: Array<{
          id: string;
          options: Array<{ id: string; text: string }>;
        }>;
      }> = [];

      const answerKeyItems: Record<string, Record<string, string>> = {};

      for (const [idx, item] of examItems.entries()) {
        if (!item.prompt.trim()) {
          throw new Error(`La oración ${idx + 1} no puede tener texto vacío`);
        }
        if (!item.option1.trim() || !item.option2.trim()) {
          throw new Error(`Las opciones de la oración ${idx + 1} no pueden estar vacías`);
        }
        if (item.option1.trim().toLowerCase() === item.option2.trim().toLowerCase()) {
          throw new Error(`Las opciones de la oración ${idx + 1} deben ser diferentes entre sí`);
        }

        const itemId = generateUuid();
        const blankId = generateUuid();
        const opt1Id = generateUuid();
        const opt2Id = generateUuid();

        let promptWithMarker = item.prompt.trim();
        if (/\{\{[^}]+\}\}/.test(promptWithMarker)) {
          let replaced = false;
          promptWithMarker = promptWithMarker.replace(/\{\{[^}]+\}\}/g, () => {
            if (!replaced) {
              replaced = true;
              return `{{${blankId}}}`;
            }
            return '';
          });
        } else {
          promptWithMarker = `${promptWithMarker} {{${blankId}}}`;
        }

        const weightVal = parseFloat(item.weight || '0') || 0;

        itemsPayload.push({
          id: itemId,
          weight: weightVal,
          prompt: promptWithMarker,
          blanks: [
            {
              id: blankId,
              options: [
                { id: opt1Id, text: item.option1.trim() },
                { id: opt2Id, text: item.option2.trim() },
              ],
            },
          ],
        });

        answerKeyItems[itemId] = {
          [blankId]: item.correctOption === 'opt1' ? opt1Id : opt2Id,
        };
      }

      config = {
        instructions: fbInstructions.trim() || undefined,
        items: itemsPayload,
      };

      answerKey = {
        items: answerKeyItems,
      };
    } else if (type === ActivityType.game) {
      if (gameMechanic === 'order_words') {
        const words = orderWordsText.trim().split(/\s+/).filter(Boolean);
        if (words.length < 2) {
          throw new Error('La oración a ordenar debe tener al menos 2 palabras');
        }

        const tokens = words.map((w) => ({
          id: generateUuid(),
          text: w,
        }));

        config = {
          mechanic: 'order_words',
          settings: {
            tokens,
          },
        };

        answerKey = {
          solution: {
            tokenIds: tokens.map((t) => t.id),
          },
        };
      } else if (gameMechanic === 'match') {
        if (matchPairs.length < 2) {
          throw new Error('El juego de emparejar requiere al menos 2 parejas');
        }
        for (const [i, pair] of matchPairs.entries()) {
          if (!pair.leftText.trim() || !pair.rightText.trim()) {
            throw new Error(`La pareja ${i + 1} no puede tener campos vacíos`);
          }
        }

        const left = matchPairs.map((p) => ({
          id: generateUuid(),
          text: p.leftText.trim(),
        }));
        const right = matchPairs.map((p) => ({
          id: generateUuid(),
          text: p.rightText.trim(),
        }));

        const pairs: Record<string, string> = {};
        left.forEach((l, i) => {
          const r = right[i];
          if (r) {
            pairs[l.id] = r.id;
          }
        });

        config = {
          mechanic: 'match',
          settings: {
            left,
            right,
          },
        };

        answerKey = {
          solution: {
            pairs,
          },
        };
      } else if (gameMechanic === 'drag_drop') {
        if (dragTargets.length < 2) {
          throw new Error('Arrastrar y soltar requiere al menos 2 categorías / destinos');
        }
        if (dragObjects.length < 2) {
          throw new Error('Arrastrar y soltar requiere al menos 2 elementos a clasificar');
        }
        for (const [i, target] of dragTargets.entries()) {
          if (!target.name.trim()) {
            throw new Error(`El destino ${i + 1} no puede tener nombre vacío`);
          }
        }
        for (const [i, obj] of dragObjects.entries()) {
          if (!obj.text.trim()) {
            throw new Error(`El objeto ${i + 1} no puede tener texto vacío`);
          }
        }

        const targets = dragTargets.map((t) => ({
          id: generateUuid(),
          text: t.name.trim(),
        }));
        const objects = dragObjects.map((o) => ({
          id: generateUuid(),
          text: o.text.trim(),
        }));

        const placements: Record<string, string> = {};
        objects.forEach((obj, i) => {
          const dragObj = dragObjects[i];
          const rawIdx = dragObj ? dragObj.targetIndex : 0;
          const tIdx = Math.max(0, Math.min(targets.length - 1, rawIdx));
          const target = targets[tIdx];
          if (target) {
            placements[obj.id] = target.id;
          }
        });

        config = {
          mechanic: 'drag_drop',
          settings: {
            targets,
            objects,
          },
        };

        answerKey = {
          solution: {
            placements,
          },
        };
      } else if (gameMechanic === 'memory') {
        if (memoryPairs.length < 2) {
          throw new Error('El juego de memoria requiere al menos 2 parejas (4 tarjetas)');
        }
        for (const [i, pair] of memoryPairs.entries()) {
          if (!pair.card1Text.trim() || !pair.card2Text.trim()) {
            throw new Error(`La pareja ${i + 1} de memoria no puede tener tarjetas vacías`);
          }
        }

        const cards: Array<{ id: string; text: string }> = [];
        const pairs: Array<[string, string]> = [];

        memoryPairs.forEach((p) => {
          const c1Id = generateUuid();
          const c2Id = generateUuid();
          cards.push({ id: c1Id, text: p.card1Text.trim() });
          cards.push({ id: c2Id, text: p.card2Text.trim() });
          pairs.push([c1Id, c2Id]);
        });

        config = {
          mechanic: 'memory',
          settings: {
            cards,
          },
        };

        answerKey = {
          solution: {
            pairs,
          },
        };
      } else if (gameMechanic === 'timed_choice') {
        const timeLimit = parseInt(timedChoiceLimit, 10);
        if (isNaN(timeLimit) || timeLimit < 5 || timeLimit > 120) {
          throw new Error('El límite de tiempo para timed choice debe estar entre 5 y 120 segundos');
        }
        if (timedQuestions.length < 1) {
          throw new Error('El microjuego contra reloj debe tener al menos 1 pregunta');
        }

        for (const [i, q] of timedQuestions.entries()) {
          if (!q.prompt.trim()) {
            throw new Error(`La pregunta ${i + 1} no puede tener consigna vacía`);
          }
          if (!q.opt1.trim() || !q.opt2.trim()) {
            throw new Error(`Las opciones de la pregunta ${i + 1} no pueden estar vacías`);
          }
          if (q.opt1.trim().toLowerCase() === q.opt2.trim().toLowerCase()) {
            throw new Error(`Las opciones de la pregunta ${i + 1} deben ser diferentes entre sí`);
          }
        }

        const questionsWithKeys = timedQuestions.map((q) => {
          const qId = generateUuid();
          const opt1Id = generateUuid();
          const opt2Id = generateUuid();
          return {
            id: qId,
            prompt: q.prompt.trim(),
            options: [
              { id: opt1Id, text: q.opt1.trim() },
              { id: opt2Id, text: q.opt2.trim() },
            ],
            correctOptId: q.correct === 'opt1' ? opt1Id : opt2Id,
          };
        });

        const choices: Record<string, string> = {};
        questionsWithKeys.forEach((q) => {
          choices[q.id] = q.correctOptId;
        });

        config = {
          mechanic: 'timed_choice',
          settings: {
            timeLimitSeconds: timeLimit,
            questions: questionsWithKeys.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              options: q.options,
            })),
          },
        };

        answerKey = {
          solution: {
            choices,
          },
        };
      }
    }

    return {
      title: trimmedTitle,
      type,
      level,
      config,
      answerKey,
      expectedDurationSeconds: expDur,
      minPlausibleSeconds: minPlaus,
    };
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    setWeightsAdjustedNotice(false);

    try {
      const payload = buildPayload();
      if (!payload) return;

      if (isEditing && initialActivity?.id) {
        const updated = await apiFetch<ActivityEditor>(
          `/api/v1/activities/${initialActivity.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              title: payload.title,
              level: payload.level,
              config: payload.config,
              answerKey: payload.answerKey,
              expectedDurationSeconds: payload.expectedDurationSeconds,
              minPlausibleSeconds: payload.minPlausibleSeconds,
            }),
          },
        );
        setSuccess('Actividad guardada correctamente');
        if (updated.weightsAdjusted) setWeightsAdjustedNotice(true);
      } else {
        const created = await apiFetch<ActivityEditor>('/api/v1/activities', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Actividad creada exitosamente');
        if (created.weightsAdjusted) setWeightsAdjustedNotice(true);
        router.push(`/actividades/${created.id}`);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al guardar la actividad');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!initialActivity?.id) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<ActivityEditor>(`/api/v1/activities/${initialActivity.id}/publish`, {
        method: 'POST',
      });
      setSuccess('¡Actividad publicada exitosamente! Ya está disponible en el catálogo.');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EXAM_MIN_ITEMS') {
          setError('Un examen debe tener al menos 2 oraciones para ser publicado.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Error al publicar la actividad');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const currentStatus = initialActivity?.status ?? ActivityStatus.draft;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/actividades" className="hover:text-zinc-900">
          Catálogo de Actividades
        </Link>
        <span>/</span>
        <span className="text-zinc-800 font-medium truncate">
          {isEditing ? title || 'Sin título' : 'Nueva actividad'}
        </span>
      </div>

      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {isEditing ? 'Editor de actividad' : 'Nueva actividad'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                currentStatus === ActivityStatus.published
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentStatus === ActivityStatus.archived
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {currentStatus === ActivityStatus.published
                ? 'Publicada'
                : currentStatus === ActivityStatus.archived
                  ? 'Archivada'
                  : 'Borrador'}
            </span>
            {isEditing && (
              <span className="text-xs text-zinc-500">
                Versión {initialActivity?.version}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 min-h-[44px] flex items-center gap-1.5"
          >
            <span>👁️</span>
            <span>Previsualizar</span>
          </button>

          {isEditing && currentStatus === ActivityStatus.draft && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 min-h-[44px]"
            >
              Publicar
            </button>
          )}

          {currentStatus !== ActivityStatus.archived && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 min-h-[44px]"
            >
              {isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear borrador'}
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800"
        >
          {success}
        </div>
      )}

      {weightsAdjustedNotice && (
        <div
          role="status"
          className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800"
        >
          Los pesos de las oraciones del examen fueron ajustados automáticamente en décimas para
          sumar exactamente 100.0%.
        </div>
      )}

      {/* Metadata Form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
        <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-2">
          Información básica
        </h2>

        {/* Title */}
        <div>
          <label htmlFor="activity-title" className="block text-sm font-semibold text-zinc-800 mb-1">
            Título de la actividad *
          </label>
          <input
            id="activity-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Ej. Simple Present vs Continuous"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-zinc-500">{title.length}/100 caracteres</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Level */}
          <div>
            <label htmlFor="activity-level" className="block text-sm font-semibold text-zinc-800 mb-1">
              Nivel pedagógico *
            </label>
            <select
              id="activity-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={Level.A1}>A1 — Principiante inicial</option>
              <option value={Level.A2}>A2 — Principiante elemental</option>
              <option value={Level.B1}>B1 — Intermedio</option>
              <option value={Level.B2}>B2 — Intermedio alto</option>
            </select>
          </div>

          {/* Type Selector (only before creation) */}
          <div>
            <label htmlFor="activity-type" className="block text-sm font-semibold text-zinc-800 mb-1">
              Tipo de actividad
            </label>
            <select
              id="activity-type"
              value={type}
              disabled={isEditing}
              onChange={(e) => setType(e.target.value as ActivityType)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-100 disabled:cursor-not-allowed"
            >
              <option value={ActivityType.fill_blank}>Rellenar huecos (Fill in the blanks)</option>
              <option value={ActivityType.open_question}>Pregunta abierta (Open question)</option>
              <option value={ActivityType.speaking}>Expresión oral (Speaking)</option>
              <option value={ActivityType.game}>Microjuego (Game)</option>
              <option value={ActivityType.exam}>Examen (Exam)</option>
            </select>
          </div>
        </div>

        {/* Durations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label htmlFor="exp-duration" className="block text-xs font-semibold text-zinc-700 mb-1">
              Duración esperada (segundos, opcional)
            </label>
            <input
              id="exp-duration"
              type="number"
              min="1"
              value={expectedDuration}
              onChange={(e) => setExpectedDuration(e.target.value)}
              placeholder="Default según tipo"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="min-duration" className="block text-xs font-semibold text-zinc-700 mb-1">
              Mínimo plausible (segundos)
            </label>
            <input
              id="min-duration"
              type="number"
              min="1"
              value={type === ActivityType.speaking ? '2' : minPlausible}
              disabled={type === ActivityType.speaking}
              onChange={(e) => setMinPlausible(e.target.value)}
              placeholder={type === ActivityType.speaking ? '2 (fijo)' : 'Default según tipo'}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-100"
            />
            {type === ActivityType.speaking && (
              <p className="mt-1 text-xs text-zinc-500">
                La duración mínima para Speaking es fija de 2 segundos.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content Form by Type */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
        <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-2">
          Contenido de la actividad
        </h2>

        {/* FILL BLANK */}
        {type === ActivityType.fill_blank && (
          <div className="space-y-4">
            <div>
              <label htmlFor="fb-instructions" className="block text-sm font-semibold text-zinc-800 mb-1">
                Instrucciones (opcional)
              </label>
              <input
                id="fb-instructions"
                type="text"
                value={fbInstructions}
                onChange={(e) => setFbInstructions(e.target.value)}
                maxLength={2000}
                placeholder="Ej. Selecciona la opción correcta para completar la oración."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <h3 className="text-sm font-bold text-zinc-800">
                Oraciones con huecos ({fbItems.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setFbItems([
                    ...fbItems,
                    {
                      prompt: 'The {{blank1}} is sleeping.',
                      option1: 'cat',
                      option2: 'dog',
                      correctOption: 'opt1',
                    },
                  ])
                }
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                + Añadir oración
              </button>
            </div>

            {fbItems.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-200 p-4 bg-zinc-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-800">Oración {idx + 1}</h4>
                  {fbItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFbItems(fbItems.filter((_, i) => i !== idx))}
                      className="text-xs text-rose-600 hover:text-rose-800 cursor-pointer"
                      aria-label={`Eliminar oración ${idx + 1}`}
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div>
                  <label htmlFor={`fb-prompt-${idx}`} className="block text-xs font-medium text-zinc-700 mb-1">
                    Texto con hueco: usa <code>&#123;&#123;blank1&#125;&#125;</code> para indicar el espacio
                  </label>
                  <input
                    id={`fb-prompt-${idx}`}
                    aria-label={`Texto con hueco oración ${idx + 1}`}
                    type="text"
                    value={item.prompt}
                    onChange={(e) =>
                      setFbItems(
                        fbItems.map((it, i) => (i === idx ? { ...it, prompt: e.target.value } : it)),
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`fb-opt1-${idx}`} className="block text-xs font-medium text-zinc-700 mb-1">
                      Opción 1
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`fb-opt1-${idx}`}
                        aria-label={`Opción 1 oración ${idx + 1}`}
                        type="text"
                        value={item.option1}
                        onChange={(e) =>
                          setFbItems(
                            fbItems.map((it, i) => (i === idx ? { ...it, option1: e.target.value } : it)),
                          )
                        }
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <label className="flex items-center gap-1 text-xs text-emerald-700 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name={`fb-correct-${idx}`}
                          aria-label={`Marcar opción 1 como correcta para oración ${idx + 1}`}
                          checked={item.correctOption === 'opt1'}
                          onChange={() =>
                            setFbItems(
                              fbItems.map((it, i) =>
                                i === idx ? { ...it, correctOption: 'opt1' } : it,
                              ),
                            )
                          }
                        />
                        Correcta
                      </label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`fb-opt2-${idx}`} className="block text-xs font-medium text-zinc-700 mb-1">
                      Opción 2
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`fb-opt2-${idx}`}
                        aria-label={`Opción 2 oración ${idx + 1}`}
                        type="text"
                        value={item.option2}
                        onChange={(e) =>
                          setFbItems(
                            fbItems.map((it, i) => (i === idx ? { ...it, option2: e.target.value } : it)),
                          )
                        }
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <label className="flex items-center gap-1 text-xs text-emerald-700 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name={`fb-correct-${idx}`}
                          aria-label={`Marcar opción 2 como correcta para oración ${idx + 1}`}
                          checked={item.correctOption === 'opt2'}
                          onChange={() =>
                            setFbItems(
                              fbItems.map((it, i) =>
                                i === idx ? { ...it, correctOption: 'opt2' } : it,
                              ),
                            )
                          }
                        />
                        Correcta
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EXAM */}
        {type === ActivityType.exam && (
          <div className="space-y-4">
            <div>
              <label htmlFor="exam-instructions" className="block text-sm font-semibold text-zinc-800 mb-1">
                Instrucciones del examen (opcional)
              </label>
              <input
                id="exam-instructions"
                type="text"
                value={fbInstructions}
                onChange={(e) => setFbInstructions(e.target.value)}
                maxLength={2000}
                placeholder="Ej. Lee con atención cada oración y completa con la forma verbal correcta."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-800">
                  Oraciones del examen ({examItems.length})
                </h3>
                <p className="text-xs text-zinc-500">
                  Suma de pesos:{' '}
                  {examItems
                    .reduce((acc, it) => acc + (parseFloat(it.weight || '0') || 0), 0)
                    .toFixed(1)}
                  % (Debe sumar 100% para publicar)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExamItems(balanceExamWeights(examItems))}
                  className="text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-md cursor-pointer"
                >
                  ⚖️ Balancear pesos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newItems: FormSentenceItem[] = [
                      ...examItems,
                      {
                        prompt: 'She {{blank1}} to school.',
                        option1: 'goes',
                        option2: 'go',
                        correctOption: 'opt1',
                        weight: '0',
                      },
                    ];
                    setExamItems(balanceExamWeights(newItems));
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  + Añadir oración
                </button>
              </div>
            </div>

            {examItems.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-200 p-4 bg-zinc-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-800">
                    Oración {idx + 1} (Peso: {item.weight || '0'}%)
                  </h4>
                  {examItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const filtered = examItems.filter((_, i) => i !== idx);
                        setExamItems(balanceExamWeights(filtered));
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 cursor-pointer"
                      aria-label={`Eliminar oración ${idx + 1}`}
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div>
                  <label htmlFor={`exam-w${idx + 1}`} className="block text-xs font-medium text-zinc-700 mb-1">
                    Peso de la oración (0-100%):
                  </label>
                  <input
                    id={`exam-w${idx + 1}`}
                    aria-label={`Peso de la oración ${idx + 1}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.weight ?? '0'}
                    onChange={(e) =>
                      setExamItems(
                        examItems.map((it, i) => (i === idx ? { ...it, weight: e.target.value } : it)),
                      )
                    }
                    className="w-32 rounded border border-zinc-300 px-2 py-1 text-xs"
                  />
                </div>

                <div>
                  <label htmlFor={`exam-prompt-${idx}`} className="block text-xs font-medium text-zinc-700 mb-1">
                    Texto con hueco: usa <code>&#123;&#123;blank1&#125;&#125;</code> para indicar el espacio
                  </label>
                  <input
                    id={`exam-prompt-${idx}`}
                    aria-label={`Texto con hueco oración ${idx + 1}`}
                    type="text"
                    value={item.prompt}
                    onChange={(e) =>
                      setExamItems(
                        examItems.map((it, i) => (i === idx ? { ...it, prompt: e.target.value } : it)),
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`exam-opt1-${idx}`} className="block text-xs font-medium text-zinc-700 mb-1">
                      Opción 1
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`exam-opt1-${idx}`}
                        aria-label={`Opción 1 oración ${idx + 1}`}
                        type="text"
                        value={item.option1}
                        onChange={(e) =>
                          setExamItems(
                            examItems.map((it, i) =>
                              i === idx ? { ...it, option1: e.target.value } : it,
                            ),
                          )
                        }
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <label className="flex items-center gap-1 text-xs text-emerald-700 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name={`exam-correct-${idx}`}
                          aria-label={`Marcar opción 1 como correcta para oración ${idx + 1}`}
                          checked={item.correctOption === 'opt1'}
                          onChange={() =>
                            setExamItems(
                              examItems.map((it, i) =>
                                i === idx ? { ...it, correctOption: 'opt1' } : it,
                              ),
                            )
                          }
                        />
                        Correcta
                      </label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`exam-opt2-${idx}`} className="block text-xs font-medium text-zinc-700 mb-1">
                      Opción 2
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`exam-opt2-${idx}`}
                        aria-label={`Opción 2 oración ${idx + 1}`}
                        type="text"
                        value={item.option2}
                        onChange={(e) =>
                          setExamItems(
                            examItems.map((it, i) =>
                              i === idx ? { ...it, option2: e.target.value } : it,
                            ),
                          )
                        }
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <label className="flex items-center gap-1 text-xs text-emerald-700 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name={`exam-correct-${idx}`}
                          aria-label={`Marcar opción 2 como correcta para oración ${idx + 1}`}
                          checked={item.correctOption === 'opt2'}
                          onChange={() =>
                            setExamItems(
                              examItems.map((it, i) =>
                                i === idx ? { ...it, correctOption: 'opt2' } : it,
                              ),
                            )
                          }
                        />
                        Correcta
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OPEN QUESTION (RFC-01: multi-pregunta) */}
        {type === ActivityType.open_question && (
          <div className="space-y-6">
            <div>
              <label htmlFor="oq-instructions" className="block text-sm font-semibold text-zinc-800 mb-1">
                Instrucciones generales de la actividad (opcional)
              </label>
              <input
                id="oq-instructions"
                type="text"
                placeholder="Ej. Responde a las siguientes preguntas en inglés con oraciones completas."
                value={oqInstructions}
                onChange={(e) => setOqInstructions(e.target.value)}
                maxLength={2000}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-900">
                  Preguntas abiertas ({oqQuestions.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setOqQuestions((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        prompt: '',
                        rubric: '',
                        maxLength: '2000',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>+</span>
                  <span>Agregar otra pregunta</span>
                </button>
              </div>

              {oqQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-zinc-600 tracking-wide">
                      Pregunta #{idx + 1}
                    </span>
                    {oqQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setOqQuestions((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                        aria-label={`Eliminar pregunta ${idx + 1}`}
                      >
                        Eliminar pregunta
                      </button>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`oq-prompt-${idx}`}
                      className="block text-xs font-semibold text-zinc-700 mb-1"
                    >
                      Consigna / Pregunta *
                    </label>
                    <textarea
                      id={`oq-prompt-${idx}`}
                      rows={3}
                      value={q.prompt}
                      onChange={(e) =>
                        setOqQuestions((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, prompt: e.target.value } : item,
                          ),
                        )
                      }
                      maxLength={5000}
                      placeholder="Escribe la consigna en inglés..."
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={`oq-rubric-${idx}`}
                        className="block text-xs font-semibold text-zinc-700 mb-1"
                      >
                        Rúbrica (opcional)
                      </label>
                      <input
                        id={`oq-rubric-${idx}`}
                        type="text"
                        value={q.rubric}
                        onChange={(e) =>
                          setOqQuestions((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, rubric: e.target.value } : item,
                            ),
                          )
                        }
                        maxLength={2000}
                        placeholder="Ej. Vocabulario y tiempos verbales"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`oq-max-len-${idx}`}
                        className="block text-xs font-semibold text-zinc-700 mb-1"
                      >
                        Límite de caracteres
                      </label>
                      <input
                        id={`oq-max-len-${idx}`}
                        type="number"
                        min="1"
                        max="10000"
                        value={q.maxLength}
                        onChange={(e) =>
                          setOqQuestions((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, maxLength: e.target.value } : item,
                            ),
                          )
                        }
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SPEAKING */}
        {type === ActivityType.speaking && (
          <div className="space-y-4">
            <div>
              <label htmlFor="sp-prompt" className="block text-sm font-semibold text-zinc-800 mb-1">
                Consigna de grabación *
              </label>
              <textarea
                id="sp-prompt"
                rows={3}
                value={spPrompt}
                onChange={(e) => setSpPrompt(e.target.value)}
                maxLength={5000}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="sp-url" className="block text-sm font-semibold text-zinc-800 mb-1">
                URL de audio de ejemplo (HTTPS, opcional)
              </label>
              <input
                id="sp-url"
                type="url"
                value={spExampleUrl}
                onChange={(e) => setSpExampleUrl(e.target.value)}
                placeholder="https://assets.englove.edu/samples/intro.mp3"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sp-min-dur" className="block text-sm font-semibold text-zinc-800 mb-1">
                  Duración mínima requerida
                </label>
                <input
                  id="sp-min-dur"
                  type="number"
                  value={2}
                  disabled
                  readOnly
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Fijo en 2 segundos según las especificaciones pedagógicas (RF-5).
                </p>
              </div>

              <div>
                <label htmlFor="sp-max-dur" className="block text-sm font-semibold text-zinc-800 mb-1">
                  Duración máxima de grabación (segundos, 2-300)
                </label>
                <input
                  id="sp-max-dur"
                  type="number"
                  min="2"
                  max="300"
                  value={spMaxDuration}
                  onChange={(e) => setSpMaxDuration(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* GAME: MECHANIC & SETTINGS */}
        {type === ActivityType.game && (
          <div className="space-y-4">
            <div>
              <label htmlFor="game-mechanic" className="block text-sm font-semibold text-zinc-800 mb-1">
                Mecánica del microjuego {isEditing && '(no modificable tras creación)'}
              </label>
              <select
                id="game-mechanic"
                value={gameMechanic}
                disabled={isEditing}
                onChange={(e) => setGameMechanic(e.target.value as GameMechanicType)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100 disabled:cursor-not-allowed"
              >
                <option value="order_words">Ordenar palabras (Order words)</option>
                <option value="match">Emparejar (Match)</option>
                <option value="drag_drop">Arrastrar y soltar (Drag & drop)</option>
                <option value="memory">Memoria (Memory)</option>
                <option value="timed_choice">Opción contra reloj (Timed choice)</option>
              </select>
              {isEditing && (
                <p className="mt-1 text-xs text-zinc-500">
                  La mecánica de un microjuego no se puede cambiar después de su creación.
                </p>
              )}
            </div>

            {/* 1. ORDER WORDS */}
            {gameMechanic === 'order_words' && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-2">
                <label htmlFor="order-words" className="block text-sm font-semibold text-zinc-800 mb-1">
                  Oración a ordenar (palabras separadas por espacios) *
                </label>
                <input
                  id="order-words"
                  type="text"
                  value={orderWordsText}
                  onChange={(e) => setOrderWordsText(e.target.value)}
                  placeholder="Ej. The dog plays in the garden"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <p className="text-xs text-zinc-500">
                  El alumno recibirá las palabras desordenadas y deberá organizarlas en el orden exacto.
                </p>
              </div>
            )}

            {/* 2. MATCH */}
            {gameMechanic === 'match' && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800">Parejas a emparejar</h3>
                    <p className="text-xs text-zinc-500">Mínimo 2 parejas.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMatchPairs([...matchPairs, { leftText: '', rightText: '' }])}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Añadir pareja
                  </button>
                </div>
                <div className="space-y-2">
                  {matchPairs.map((pair, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        id={`match-pair-left-${idx}`}
                        aria-label={`Elemento izquierdo pareja ${idx + 1}`}
                        type="text"
                        placeholder="Elemento izquierdo (ej. Apple)"
                        value={pair.leftText}
                        onChange={(e) =>
                          setMatchPairs(
                            matchPairs.map((p, i) =>
                              i === idx ? { ...p, leftText: e.target.value } : p,
                            ),
                          )
                        }
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <span className="text-xs text-zinc-400">↔</span>
                      <input
                        id={`match-pair-right-${idx}`}
                        aria-label={`Elemento derecho pareja ${idx + 1}`}
                        type="text"
                        placeholder="Elemento derecho (ej. Manzana)"
                        value={pair.rightText}
                        onChange={(e) =>
                          setMatchPairs(
                            matchPairs.map((p, i) =>
                              i === idx ? { ...p, rightText: e.target.value } : p,
                            ),
                          )
                        }
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <button
                        type="button"
                        disabled={matchPairs.length <= 2}
                        onClick={() => setMatchPairs(matchPairs.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed px-1 cursor-pointer"
                        title="Eliminar pareja"
                        aria-label={`Eliminar pareja ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. DRAG AND DROP */}
            {gameMechanic === 'drag_drop' && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-4">
                {/* Targets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">Categorías / Destinos</h3>
                      <p className="text-xs text-zinc-500">Mínimo 2 destinos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDragTargets([...dragTargets, { name: '' }])}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      + Añadir categoría
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dragTargets.map((target, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-16">Cat. {idx + 1}:</span>
                        <input
                          id={`drag-target-${idx}`}
                          aria-label={`Nombre de la categoría ${idx + 1}`}
                          type="text"
                          placeholder="Nombre del destino (ej. Fruits)"
                          value={target.name}
                          onChange={(e) =>
                            setDragTargets(
                              dragTargets.map((t, i) =>
                                i === idx ? { ...t, name: e.target.value } : t,
                              ),
                            )
                          }
                          className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                        />
                        <button
                          type="button"
                          disabled={dragTargets.length <= 2}
                          onClick={() => {
                            setDragTargets(dragTargets.filter((_, i) => i !== idx));
                            setDragObjects(
                              dragObjects.map((o) => ({
                                ...o,
                                targetIndex:
                                  o.targetIndex >= idx
                                    ? Math.max(0, o.targetIndex - 1)
                                    : o.targetIndex,
                              })),
                            );
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed px-1 cursor-pointer"
                          title="Eliminar categoría"
                          aria-label={`Eliminar categoría ${idx + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Objects */}
                <div className="space-y-2 border-t border-zinc-200 pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">Elementos a clasificar</h3>
                      <p className="text-xs text-zinc-500">Mínimo 2 elementos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDragObjects([...dragObjects, { text: '', targetIndex: 0 }])
                      }
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      + Añadir elemento
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dragObjects.map((obj, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          id={`drag-object-${idx}`}
                          aria-label={`Texto del elemento a clasificar ${idx + 1}`}
                          type="text"
                          placeholder="Texto del elemento (ej. Orange)"
                          value={obj.text}
                          onChange={(e) =>
                            setDragObjects(
                              dragObjects.map((o, i) =>
                                i === idx ? { ...o, text: e.target.value } : o,
                              ),
                            )
                          }
                          className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                        />
                        <span className="text-xs text-zinc-500">→</span>
                        <select
                          id={`drag-target-select-${idx}`}
                          aria-label={`Categoría asignada para el elemento ${idx + 1}`}
                          value={obj.targetIndex}
                          onChange={(e) =>
                            setDragObjects(
                              dragObjects.map((o, i) =>
                                i === idx
                                  ? { ...o, targetIndex: parseInt(e.target.value, 10) || 0 }
                                  : o,
                              ),
                            )
                          }
                          className="rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900 max-w-[150px]"
                        >
                          {dragTargets.map((t, tIdx) => (
                            <option key={tIdx} value={tIdx}>
                              {t.name || `Cat. ${tIdx + 1}`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={dragObjects.length <= 2}
                          onClick={() => setDragObjects(dragObjects.filter((_, i) => i !== idx))}
                          className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed px-1 cursor-pointer"
                          title="Eliminar elemento"
                          aria-label={`Eliminar elemento a clasificar ${idx + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. MEMORY */}
            {gameMechanic === 'memory' && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800">Parejas de memoria</h3>
                    <p className="text-xs text-zinc-500">
                      Mínimo 2 parejas (4 tarjetas en total).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMemoryPairs([...memoryPairs, { card1Text: '', card2Text: '' }])
                    }
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    + Añadir pareja
                  </button>
                </div>
                <div className="space-y-2">
                  {memoryPairs.map((pair, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        id={`memory-card-1-${idx}`}
                        aria-label={`Tarjeta 1 pareja ${idx + 1}`}
                        type="text"
                        placeholder="Tarjeta 1 (ej. Dog)"
                        value={pair.card1Text}
                        onChange={(e) =>
                          setMemoryPairs(
                            memoryPairs.map((p, i) =>
                              i === idx ? { ...p, card1Text: e.target.value } : p,
                            ),
                          )
                        }
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <span className="text-xs text-zinc-400">♥</span>
                      <input
                        id={`memory-card-2-${idx}`}
                        aria-label={`Tarjeta 2 pareja ${idx + 1}`}
                        type="text"
                        placeholder="Tarjeta 2 (ej. Perro)"
                        value={pair.card2Text}
                        onChange={(e) =>
                          setMemoryPairs(
                            memoryPairs.map((p, i) =>
                              i === idx ? { ...p, card2Text: e.target.value } : p,
                            ),
                          )
                        }
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <button
                        type="button"
                        disabled={memoryPairs.length <= 2}
                        onClick={() => setMemoryPairs(memoryPairs.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed px-1 cursor-pointer"
                        title="Eliminar pareja"
                        aria-label={`Eliminar pareja de memoria ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. TIMED CHOICE */}
            {gameMechanic === 'timed_choice' && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-4">
                <div>
                  <label htmlFor="timed-limit" className="block text-xs font-semibold text-zinc-700 mb-1">
                    Tiempo límite por pregunta (segundos, 5-120) *
                  </label>
                  <input
                    id="timed-limit"
                    type="number"
                    min="5"
                    max="120"
                    value={timedChoiceLimit}
                    onChange={(e) => setTimedChoiceLimit(e.target.value)}
                    className="w-32 rounded border border-zinc-300 px-2 py-1 text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">Preguntas contra reloj</h3>
                      <p className="text-xs text-zinc-500">Mínimo 1 pregunta.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTimedQuestions([
                          ...timedQuestions,
                          { prompt: '', opt1: '', opt2: '', correct: 'opt1' },
                        ])
                      }
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      + Añadir pregunta
                    </button>
                  </div>

                  {timedQuestions.map((q, idx) => (
                    <div key={idx} className="rounded border border-zinc-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700">Pregunta {idx + 1}</span>
                        <button
                          type="button"
                          disabled={timedQuestions.length <= 1}
                          onClick={() => setTimedQuestions(timedQuestions.filter((_, i) => i !== idx))}
                          className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          aria-label={`Eliminar pregunta contra reloj ${idx + 1}`}
                        >
                          Eliminar
                        </button>
                      </div>

                      <input
                        id={`tc-prompt-${idx}`}
                        aria-label={`Consigna pregunta contra reloj ${idx + 1}`}
                        type="text"
                        placeholder="Consigna (ej. What color is the sun?)"
                        value={q.prompt}
                        onChange={(e) =>
                          setTimedQuestions(
                            timedQuestions.map((item, i) =>
                              i === idx ? { ...item, prompt: e.target.value } : item,
                            ),
                          )
                        }
                        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <input
                            id={`tc-opt1-${idx}`}
                            aria-label={`Opción 1 pregunta ${idx + 1}`}
                            type="text"
                            placeholder="Opción 1"
                            value={q.opt1}
                            onChange={(e) =>
                              setTimedQuestions(
                                timedQuestions.map((item, i) =>
                                  i === idx ? { ...item, opt1: e.target.value } : item,
                                ),
                              )
                            }
                            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <label className="flex items-center gap-1 text-xs text-emerald-700 cursor-pointer">
                            <input
                              type="radio"
                              name={`tc-correct-${idx}`}
                              aria-label={`Marcar opción 1 como correcta para pregunta ${idx + 1}`}
                              checked={q.correct === 'opt1'}
                              onChange={() =>
                                setTimedQuestions(
                                  timedQuestions.map((item, i) =>
                                    i === idx ? { ...item, correct: 'opt1' } : item,
                                  ),
                                )
                              }
                            />
                            Correcta
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            id={`tc-opt2-${idx}`}
                            aria-label={`Opción 2 pregunta ${idx + 1}`}
                            type="text"
                            placeholder="Opción 2"
                            value={q.opt2}
                            onChange={(e) =>
                              setTimedQuestions(
                                timedQuestions.map((item, i) =>
                                  i === idx ? { ...item, opt2: e.target.value } : item,
                                ),
                              )
                            }
                            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <label className="flex items-center gap-1 text-xs text-emerald-700 cursor-pointer">
                            <input
                              type="radio"
                              name={`tc-correct-${idx}`}
                              aria-label={`Marcar opción 2 como correcta para pregunta ${idx + 1}`}
                              checked={q.correct === 'opt2'}
                              onChange={() =>
                                setTimedQuestions(
                                  timedQuestions.map((item, i) =>
                                    i === idx ? { ...item, correct: 'opt2' } : item,
                                  ),
                                )
                              }
                            />
                            Correcta
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity Preview Modal (ENG-039, RF-16 SPEC-04, RF-12 SPEC-05) */}
      {isPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👀</span>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Previsualización Docente</h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    Vista previa: no se guardan respuestas (ENG-039). Modo interactivo de prueba sin alterar métricas.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 border border-zinc-200"
                  role="group"
                  aria-label="Selector de tema para previsualización"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewTheme('kids')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      previewTheme === 'kids'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    🧒 Kids
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTheme('teens')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      previewTheme === 'teens'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    🧑‍🎓 Teens
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div
              className={`p-6 rounded-2xl border space-y-4 ${
                previewTheme === 'kids'
                  ? 'border-amber-200 bg-amber-50/40 text-amber-950'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-100'
              }`}
              data-theme={previewTheme}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900">
                  Nivel {level}
                </span>
                <span className="text-xs font-semibold text-zinc-500 capitalize">{type}</span>
              </div>
              <h3 className="text-xl font-black text-amber-950">{title || 'Actividad sin título'}</h3>

              {type === ActivityType.fill_blank && (
                <div className="space-y-3 bg-white p-4 rounded-xl border border-amber-200">
                  <p className="text-xs font-bold text-zinc-500">
                    Oraciones con huecos ({fbItems.length})
                  </p>
                  {fbItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="border-b border-amber-100 last:border-b-0 pb-2 last:pb-0 space-y-1"
                    >
                      <p className="text-base text-zinc-800">
                        {idx + 1}. {it.prompt}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs">
                          A: {it.option1}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs">
                          B: {it.option2}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {type === ActivityType.speaking && (
                <div className="space-y-3 bg-white p-4 rounded-xl border border-amber-200 text-center">
                  <p className="text-sm font-bold text-amber-900">{spPrompt || 'Pronuncia la frase en voz alta'}</p>
                  <div className="p-4 rounded-xl bg-amber-50 inline-block text-xs font-semibold text-zinc-600">
                    🎙️ Grabadora de voz simulada (2 a 120 segundos)
                  </div>
                </div>
              )}

              {type === ActivityType.open_question && (
                <div className="space-y-4 bg-white p-4 rounded-xl border border-amber-200">
                  {oqInstructions && (
                    <div className="p-2.5 bg-amber-50 rounded-lg text-xs text-amber-900 border border-amber-200 font-medium">
                      <strong>Instrucciones:</strong> {oqInstructions}
                    </div>
                  )}
                  {oqQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="space-y-1.5 p-3 rounded-lg border border-amber-100 bg-amber-50/30">
                      <p className="text-xs font-bold text-amber-900">
                        {oqQuestions.length > 1 ? `Pregunta ${idx + 1}:` : 'Consigna:'}
                      </p>
                      <p className="text-sm font-semibold text-zinc-800">{q.prompt || 'Sin consigna'}</p>
                      {q.rubric && (
                        <p className="text-[11px] text-zinc-500 italic">Rúbrica: {q.rubric}</p>
                      )}
                      <textarea
                        disabled
                        placeholder="Aquí el alumno escribirá su respuesta..."
                        className="w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-400 bg-white"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}

              {type === ActivityType.exam && (
                <div className="space-y-3 bg-white p-4 rounded-xl border border-amber-200">
                  <p className="text-xs font-bold text-zinc-500">
                    Ítems ponderados del examen ({examItems.length})
                  </p>
                  {examItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="border-b border-amber-100 last:border-b-0 pb-2 last:pb-0"
                    >
                      <p className="text-sm text-zinc-800">
                        {idx + 1}. {it.prompt}{' '}
                        <span className="text-xs text-zinc-500">({it.weight || '0'}%)</span>
                      </p>
                      <div className="flex gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 text-xs">
                          A: {it.option1}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 text-xs">
                          B: {it.option2}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {type === ActivityType.game && (() => {
                let previewConfig: GamePublicConfig | null;
                try {
                  const payload = buildPayload();
                  if (!payload) {
                    previewConfig = null;
                  } else {
                    previewConfig = {
                      ...(payload.config as GamePublicConfig),
                      answerKey: (payload.answerKey as GameAnswerKey) || undefined,
                    };
                  }
                } catch {
                  previewConfig = null;
                }

                if (!previewConfig) {
                  return (
                    <div className="p-4 bg-white rounded-xl border border-amber-200 text-center">
                      <p className="text-xs font-bold text-amber-800 uppercase">Previsualización de {gameMechanic}</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        Completa los campos requeridos de la mecánica para interactuar con la previsualización.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="p-4 bg-white rounded-2xl border border-amber-200">
                    <GameRenderer
                      config={previewConfig}
                      previewMode={true}
                      theme={previewTheme}
                    />
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-xl bg-zinc-900 text-white font-bold px-5 py-2 text-xs hover:bg-zinc-800"
              >
                Cerrar previsualización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
