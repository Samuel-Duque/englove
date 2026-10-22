'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActivityType,
  ActivityStatus,
  Level,
  ActivityEditor,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

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

function getFirstItem(config: unknown): Record<string, unknown> | null {
  const rec = asRecord(config);
  if (rec && Array.isArray(rec['items']) && rec['items'].length > 0) {
    return asRecord(rec['items'][0]);
  }
  return null;
}

function getFirstBlankOption(config: unknown, optIndex: number, fallback: string): string {
  const item = getFirstItem(config);
  if (item && Array.isArray(item['blanks']) && item['blanks'].length > 0) {
    const blank = asRecord(item['blanks'][0]);
    if (blank && Array.isArray(blank['options']) && blank['options'].length > optIndex) {
      const opt = asRecord(blank['options'][optIndex]);
      if (opt && typeof opt['text'] === 'string') return opt['text'] as string;
    }
  }
  return fallback;
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
  const [fbPrompt, setFbPrompt] = useState(
    getStringProp(getFirstItem(initialCfg), 'prompt', 'The {{blank1}} is sleeping.'),
  );
  const [fbOption1, setFbOption1] = useState(
    getFirstBlankOption(initialCfg, 0, 'cat'),
  );
  const [fbOption2, setFbOption2] = useState(
    getFirstBlankOption(initialCfg, 1, 'dog'),
  );
  const [fbCorrectOption, setFbCorrectOption] = useState<'opt1' | 'opt2'>('opt1');

  // Exam second item (for publishing >= 2 items)
  const [examItem2Prompt, setExamItem2Prompt] = useState('She {{blank2}} to school.');
  const [examItem2Opt1, setExamItem2Opt1] = useState('goes');
  const [examItem2Opt2, setExamItem2Opt2] = useState('go');
  const [examItem2Correct, setExamItem2Correct] = useState<'opt1' | 'opt2'>('opt1');
  const [examItem1Weight, setExamItem1Weight] = useState('50');
  const [examItem2Weight, setExamItem2Weight] = useState('50');

  // Open Question
  const [oqPrompt, setOqPrompt] = useState(
    getStringProp(
      initialCfg,
      'prompt',
      'Describe your best friend and what you like doing together.',
    ),
  );
  const [oqRubric, setOqRubric] = useState(
    getStringProp(initialCfg, 'rubric', 'Grammar, vocabulary, and coherence.'),
  );
  const [oqMaxLength, setOqMaxLength] = useState(
    getStringProp(initialCfg, 'maxLength', '2000'),
  );

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
      const itemId = '11111111-1111-4111-8111-111111111101';
      const blankId = '22222222-2222-4222-8222-222222222201';
      const opt1Id = '33333333-3333-4333-8333-333333333301';
      const opt2Id = '33333333-3333-4333-8333-333333333302';

      const promptWithMarker = fbPrompt.includes(`{{${blankId}}}`)
        ? fbPrompt
        : fbPrompt.replace(/\{\{[^}]+\}\}/, `{{${blankId}}}`);

      config = {
        instructions: fbInstructions.trim() || undefined,
        items: [
          {
            id: itemId,
            prompt: promptWithMarker,
            blanks: [
              {
                id: blankId,
                options: [
                  { id: opt1Id, text: fbOption1.trim() },
                  { id: opt2Id, text: fbOption2.trim() },
                ],
              },
            ],
          },
        ],
      };

      answerKey = {
        items: {
          [itemId]: {
            [blankId]: fbCorrectOption === 'opt1' ? opt1Id : opt2Id,
          },
        },
      };
    } else if (type === ActivityType.open_question) {
      config = {
        prompt: oqPrompt.trim(),
        rubric: oqRubric.trim() || undefined,
        maxLength: oqMaxLength ? parseInt(oqMaxLength, 10) : 2000,
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
      const item1Id = '11111111-1111-4111-8111-111111111101';
      const blank1Id = '22222222-2222-4222-8222-222222222201';
      const opt1Id = '33333333-3333-4333-8333-333333333301';
      const opt2Id = '33333333-3333-4333-8333-333333333302';

      const item2Id = '11111111-1111-4111-8111-111111111102';
      const blank2Id = '22222222-2222-4222-8222-222222222202';
      const opt3Id = '33333333-3333-4333-8333-333333333303';
      const opt4Id = '33333333-3333-4333-8333-333333333304';

      const prompt1 = fbPrompt.includes(`{{${blank1Id}}}`)
        ? fbPrompt
        : fbPrompt.replace(/\{\{[^}]+\}\}/, `{{${blank1Id}}}`);
      const prompt2 = examItem2Prompt.includes(`{{${blank2Id}}}`)
        ? examItem2Prompt
        : examItem2Prompt.replace(/\{\{[^}]+\}\}/, `{{${blank2Id}}}`);

      config = {
        instructions: fbInstructions.trim() || undefined,
        items: [
          {
            id: item1Id,
            prompt: prompt1,
            weight: parseFloat(examItem1Weight) || 50,
            blanks: [
              {
                id: blank1Id,
                options: [
                  { id: opt1Id, text: fbOption1.trim() },
                  { id: opt2Id, text: fbOption2.trim() },
                ],
              },
            ],
          },
          {
            id: item2Id,
            prompt: prompt2,
            weight: parseFloat(examItem2Weight) || 50,
            blanks: [
              {
                id: blank2Id,
                options: [
                  { id: opt3Id, text: examItem2Opt1.trim() },
                  { id: opt4Id, text: examItem2Opt2.trim() },
                ],
              },
            ],
          },
        ],
      };

      answerKey = {
        items: {
          [item1Id]: { [blank1Id]: fbCorrectOption === 'opt1' ? opt1Id : opt2Id },
          [item2Id]: { [blank2Id]: examItem2Correct === 'opt1' ? opt3Id : opt4Id },
        },
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

        {/* FILL BLANK & EXAM */}
        {(type === ActivityType.fill_blank || type === ActivityType.exam) && (
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

            <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50 space-y-3">
              <h3 className="text-sm font-bold text-zinc-800">
                Oración 1 {type === ActivityType.exam && `(Peso: ${examItem1Weight}%)`}
              </h3>

              {type === ActivityType.exam && (
                <div>
                  <label htmlFor="exam-w1" className="block text-xs font-medium text-zinc-700 mb-1">
                    Peso de la oración (0-100):
                  </label>
                  <input
                    id="exam-w1"
                    type="number"
                    min="0"
                    max="100"
                    value={examItem1Weight}
                    onChange={(e) => setExamItem1Weight(e.target.value)}
                    className="w-32 rounded border border-zinc-300 px-2 py-1 text-xs"
                  />
                </div>
              )}

              <div>
                <label htmlFor="fb-prompt" className="block text-xs font-medium text-zinc-700 mb-1">
                  Texto con hueco: usa <code>&#123;&#123;blank1&#125;&#125;</code> para indicar el espacio
                </label>
                <input
                  id="fb-prompt"
                  type="text"
                  value={fbPrompt}
                  onChange={(e) => setFbPrompt(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fb-opt1" className="block text-xs font-medium text-zinc-700 mb-1">
                    Opción 1
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="fb-opt1"
                      type="text"
                      value={fbOption1}
                      onChange={(e) => setFbOption1(e.target.value)}
                      className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                    />
                    <label className="flex items-center gap-1 text-xs text-emerald-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="correct-opt1"
                        checked={fbCorrectOption === 'opt1'}
                        onChange={() => setFbCorrectOption('opt1')}
                      />
                      Correcta
                    </label>
                  </div>
                </div>

                <div>
                  <label htmlFor="fb-opt2" className="block text-xs font-medium text-zinc-700 mb-1">
                    Opción 2
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="fb-opt2"
                      type="text"
                      value={fbOption2}
                      onChange={(e) => setFbOption2(e.target.value)}
                      className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                    />
                    <label className="flex items-center gap-1 text-xs text-emerald-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="correct-opt1"
                        checked={fbCorrectOption === 'opt2'}
                        onChange={() => setFbCorrectOption('opt2')}
                      />
                      Correcta
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Exam requires >= 2 items to publish */}
            {type === ActivityType.exam && (
              <div className="rounded-lg border border-zinc-200 p-4 bg-zinc-50 space-y-3">
                <h3 className="text-sm font-bold text-zinc-800">
                  Oración 2 (Peso: {examItem2Weight}%)
                </h3>

                <div>
                  <label htmlFor="exam-w2" className="block text-xs font-medium text-zinc-700 mb-1">
                    Peso de la oración (0-100):
                  </label>
                  <input
                    id="exam-w2"
                    type="number"
                    min="0"
                    max="100"
                    value={examItem2Weight}
                    onChange={(e) => setExamItem2Weight(e.target.value)}
                    className="w-32 rounded border border-zinc-300 px-2 py-1 text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="exam-p2" className="block text-xs font-medium text-zinc-700 mb-1">
                    Texto con hueco: usa <code>&#123;&#123;blank2&#125;&#125;</code> para indicar el espacio
                  </label>
                  <input
                    id="exam-p2"
                    type="text"
                    value={examItem2Prompt}
                    onChange={(e) => setExamItem2Prompt(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="exam-opt1" className="block text-xs font-medium text-zinc-700 mb-1">
                      Opción 1
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="exam-opt1"
                        type="text"
                        value={examItem2Opt1}
                        onChange={(e) => setExamItem2Opt1(e.target.value)}
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <label className="flex items-center gap-1 text-xs text-emerald-700 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="correct-opt2"
                          checked={examItem2Correct === 'opt1'}
                          onChange={() => setExamItem2Correct('opt1')}
                        />
                        Correcta
                      </label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="exam-opt2" className="block text-xs font-medium text-zinc-700 mb-1">
                      Opción 2
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="exam-opt2"
                        type="text"
                        value={examItem2Opt2}
                        onChange={(e) => setExamItem2Opt2(e.target.value)}
                        className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-900"
                      />
                      <label className="flex items-center gap-1 text-xs text-emerald-700 font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="correct-opt2"
                          checked={examItem2Correct === 'opt2'}
                          onChange={() => setExamItem2Correct('opt2')}
                        />
                        Correcta
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OPEN QUESTION */}
        {type === ActivityType.open_question && (
          <div className="space-y-4">
            <div>
              <label htmlFor="oq-prompt" className="block text-sm font-semibold text-zinc-800 mb-1">
                Consigna / Pregunta *
              </label>
              <textarea
                id="oq-prompt"
                rows={4}
                value={oqPrompt}
                onChange={(e) => setOqPrompt(e.target.value)}
                maxLength={5000}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="oq-rubric" className="block text-sm font-semibold text-zinc-800 mb-1">
                Rúbrica de evaluación (visible para el alumno, opcional)
              </label>
              <textarea
                id="oq-rubric"
                rows={2}
                value={oqRubric}
                onChange={(e) => setOqRubric(e.target.value)}
                maxLength={2000}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="oq-max-len" className="block text-sm font-semibold text-zinc-800 mb-1">
                Límite de caracteres de respuesta
              </label>
              <input
                id="oq-max-len"
                type="number"
                min="1"
                max="10000"
                value={oqMaxLength}
                onChange={(e) => setOqMaxLength(e.target.value)}
                className="w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
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
                        className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed px-1"
                        title="Eliminar pareja"
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
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      + Añadir categoría
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dragTargets.map((target, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-16">Cat. {idx + 1}:</span>
                        <input
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
                          className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed px-1"
                          title="Eliminar categoría"
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
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      + Añadir elemento
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dragObjects.map((obj, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
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
                          className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed px-1"
                          title="Eliminar elemento"
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
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Añadir pareja
                  </button>
                </div>
                <div className="space-y-2">
                  {memoryPairs.map((pair, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
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
                        className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed px-1"
                        title="Eliminar pareja"
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
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
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
                          className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      </div>

                      <input
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
    </div>
  );
}
