'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityType,
  ActivityStatus,
  Level,
  ActivityEditor,
  ActivityEditorSchema,
  GamePublicConfig,
  GameAnswerKey,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { speak } from '../../../lib/speech';
import {
  OpenQuestionRenderer,
  SentenceRenderer,
  SpeakingRenderer,
} from '../../../components/activities/DidacticRenderers';
import { GameRenderer } from '../../../components/activities/GameRenderer';
import { AccessibleModal } from '../../../components/ui/modal';
import { activityTypeLabels } from './activity-labels';

interface ActivityEditorProps {
  initialActivity?: ActivityEditor;
  onActivityUpdated?: (activity: ActivityEditor) => void;
}

type GameMechanicType = 'match' | 'order_words' | 'drag_drop' | 'memory' | 'timed_choice';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function asRecord(val: unknown): Record<string, unknown> | null {
  if (isRecord(val)) {
    return val;
  }
  return null;
}

function getStringProp(obj: unknown, key: string, fallback = ''): string {
  if (isRecord(obj)) {
    const v = obj[key];
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
  }
  return fallback;
}

function isIdTextItem(val: unknown): val is { id: string; text: string } {
  return isRecord(val) && typeof val.id === 'string' && typeof val.text === 'string';
}

function isTextItem(val: unknown): val is { text: string } {
  return isRecord(val) && typeof val.text === 'string';
}

function isStringPair(val: unknown): val is [string, string] {
  return Array.isArray(val) && val.length === 2 && typeof val[0] === 'string' && typeof val[1] === 'string';
}

interface ParsedTimedQuestion {
  id: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
}

function isTimedQuestion(val: unknown): val is ParsedTimedQuestion {
  if (!isRecord(val)) return false;
  return (
    typeof val.id === 'string' &&
    typeof val.prompt === 'string' &&
    Array.isArray(val.options)
  );
}

function isGameMechanicType(val: string): val is GameMechanicType {
  return (
    val === 'match' ||
    val === 'order_words' ||
    val === 'drag_drop' ||
    val === 'memory' ||
    val === 'timed_choice'
  );
}

function isLevel(val: string): val is Level {
  return val === Level.A1 || val === Level.A2 || val === Level.B1 || val === Level.B2;
}

function isActivityType(val: string): val is ActivityType {
  return (
    val === ActivityType.fill_blank ||
    val === ActivityType.open_question ||
    val === ActivityType.speaking ||
    val === ActivityType.game ||
    val === ActivityType.exam
  );
}

function isGamePublicConfig(cfg: unknown): cfg is GamePublicConfig {
  return isRecord(cfg) && typeof cfg.mechanic === 'string' && 'settings' in cfg;
}

function isGameAnswerKey(ak: unknown): ak is GameAnswerKey {
  return isRecord(ak) && 'solution' in ak;
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface FormOption {
  id: string;
  text: string;
}

export interface FormBlank {
  id: string;
  options: FormOption[];
  correctOptionId: string;
}

export interface FormSentenceItem {
  id: string;
  prompt: string;
  blanks: FormBlank[];
  weight?: string;
}

export function buildSentencePromptWithMarkers(rawPrompt: string, blanks: FormBlank[]): string {
  let prompt = rawPrompt.trim();
  const blankIdSet = new Set(blanks.map((b) => b.id));
  const usedBlankIds = new Set<string>();

  // Find all markers in the prompt
  const markers = prompt.match(/\{\{([^}]+)\}\}/g) || [];
  let nextUnassignedIdx = 0;

  const getNextUnassignedBlankId = (): string | null => {
    while (nextUnassignedIdx < blanks.length) {
      const b = blanks[nextUnassignedIdx++];
      if (b && !usedBlankIds.has(b.id)) {
        return b.id;
      }
    }
    return null;
  };

  for (const m of markers) {
    const inner = m.slice(2, -2).trim();
    if (blankIdSet.has(inner) && !usedBlankIds.has(inner)) {
      usedBlankIds.add(inner);
    } else {
      const targetId = getNextUnassignedBlankId();
      if (targetId) {
        prompt = prompt.replace(m, `{{${targetId}}}`);
        usedBlankIds.add(targetId);
      } else {
        // Orphaned or duplicate marker with no blanks left: remove cleanly
        prompt = prompt.replace(m, '');
      }
    }
  }

  // Ensure every blank has its marker in the prompt exactly once
  for (const b of blanks) {
    if (!usedBlankIds.has(b.id) && !prompt.includes(`{{${b.id}}}`)) {
      prompt = `${prompt} {{${b.id}}}`.trim();
      usedBlankIds.add(b.id);
    }
  }

  return prompt.replace(/\s+/g, ' ').trim();
}

const DEFAULT_FB_ITEM_ID = '10000000-0000-4000-8000-000000000001';
const DEFAULT_FB_BLANK_ID = '10000000-0000-4000-8000-000000000002';
const DEFAULT_FB_OPT1_ID = '10000000-0000-4000-8000-000000000003';
const DEFAULT_FB_OPT2_ID = '10000000-0000-4000-8000-000000000004';

const DEFAULT_EXAM_ITEM1_ID = '20000000-0000-4000-8000-000000000001';
const DEFAULT_EXAM_BLANK1_ID = '20000000-0000-4000-8000-000000000002';
const DEFAULT_EXAM_OPT1A_ID = '20000000-0000-4000-8000-000000000003';
const DEFAULT_EXAM_OPT1B_ID = '20000000-0000-4000-8000-000000000004';

const DEFAULT_EXAM_ITEM2_ID = '20000000-0000-4000-8000-000000000005';
const DEFAULT_EXAM_BLANK2_ID = '20000000-0000-4000-8000-000000000006';
const DEFAULT_EXAM_OPT2A_ID = '20000000-0000-4000-8000-000000000007';
const DEFAULT_EXAM_OPT2B_ID = '20000000-0000-4000-8000-000000000008';

export function parseInitialFillBlankItems(cfg: unknown, ak: unknown): FormSentenceItem[] {
  const rec = asRecord(cfg);
  if (rec && Array.isArray(rec['items']) && rec['items'].length > 0) {
    const akRec = asRecord(ak);
    const rawAkItems = akRec ? akRec['items'] : null;
    const akItems = asRecord(rawAkItems) || {};

    const items: FormSentenceItem[] = [];
    for (const [idx, rawItem] of rec['items'].entries()) {
      const item = asRecord(rawItem);
      if (!item) continue;
      const itemId = typeof item['id'] === 'string' && item['id'] ? item['id'] : `item-fb-${idx + 1}`;
      const prompt = typeof item['prompt'] === 'string' ? item['prompt'] : '';

      const blanks: FormBlank[] = [];
      const itemSol = akItems[itemId] ? asRecord(akItems[itemId]) : null;

      if (Array.isArray(item['blanks']) && item['blanks'].length > 0) {
        for (const [bIdx, rawBlank] of item['blanks'].entries()) {
          const blank = asRecord(rawBlank);
          if (!blank) continue;
          const blankId = typeof blank['id'] === 'string' && blank['id'] ? blank['id'] : `blank-fb-${idx + 1}-${bIdx + 1}`;
          const options: FormOption[] = [];

          if (Array.isArray(blank['options']) && blank['options'].length > 0) {
            for (const [oIdx, rawOpt] of blank['options'].entries()) {
              const opt = asRecord(rawOpt);
              if (!opt) continue;
              const optId = typeof opt['id'] === 'string' && opt['id'] ? opt['id'] : `opt-fb-${idx + 1}-${bIdx + 1}-${oIdx + 1}`;
              const optText = typeof opt['text'] === 'string' ? opt['text'] : '';
              options.push({ id: optId, text: optText });
            }
          }

          while (options.length < 2) {
            const fallbackOptId = `opt-fb-${idx + 1}-${bIdx + 1}-${options.length + 1}`;
            options.push({ id: fallbackOptId, text: options.length === 0 ? 'Opción A' : 'Opción B' });
          }

          const correctOptId =
            (itemSol && typeof itemSol[blankId] === 'string' && itemSol[blankId]) ||
            options[0]?.id ||
            '';

          blanks.push({
            id: blankId,
            options,
            correctOptionId: correctOptId,
          });
        }
      }

      if (blanks.length === 0) {
        const bId = `blank-fb-${idx + 1}-1`;
        const o1 = { id: `opt-fb-${idx + 1}-1-1`, text: 'cat' };
        const o2 = { id: `opt-fb-${idx + 1}-1-2`, text: 'dog' };
        blanks.push({
          id: bId,
          options: [o1, o2],
          correctOptionId: o1.id,
        });
      }

      items.push({
        id: itemId,
        prompt,
        blanks,
      });
    }

    if (items.length > 0) return items;
  }

  return [
    {
      id: DEFAULT_FB_ITEM_ID,
      prompt: `The {{${DEFAULT_FB_BLANK_ID}}} is sleeping.`,
      blanks: [
        {
          id: DEFAULT_FB_BLANK_ID,
          options: [
            { id: DEFAULT_FB_OPT1_ID, text: 'cat' },
            { id: DEFAULT_FB_OPT2_ID, text: 'dog' },
          ],
          correctOptionId: DEFAULT_FB_OPT1_ID,
        },
      ],
    },
  ];
}

export function parseInitialExamItems(cfg: unknown, ak: unknown): FormSentenceItem[] {
  const rec = asRecord(cfg);
  if (rec && Array.isArray(rec['items']) && rec['items'].length > 0) {
    const akRec = asRecord(ak);
    const rawAkItems = akRec ? akRec['items'] : null;
    const akItems = asRecord(rawAkItems) || {};

    const items: FormSentenceItem[] = [];
    for (const [idx, rawItem] of rec['items'].entries()) {
      const item = asRecord(rawItem);
      if (!item) continue;
      const itemId = typeof item['id'] === 'string' && item['id'] ? item['id'] : `item-exam-${idx + 1}`;
      const prompt = typeof item['prompt'] === 'string' ? item['prompt'] : '';
      const weight = typeof item['weight'] === 'number' ? String(item['weight']) : '50';

      const blanks: FormBlank[] = [];
      const itemSol = akItems[itemId] ? asRecord(akItems[itemId]) : null;

      if (Array.isArray(item['blanks']) && item['blanks'].length > 0) {
        for (const [bIdx, rawBlank] of item['blanks'].entries()) {
          const blank = asRecord(rawBlank);
          if (!blank) continue;
          const blankId = typeof blank['id'] === 'string' && blank['id'] ? blank['id'] : `blank-exam-${idx + 1}-${bIdx + 1}`;
          const options: FormOption[] = [];

          if (Array.isArray(blank['options']) && blank['options'].length > 0) {
            for (const [oIdx, rawOpt] of blank['options'].entries()) {
              const opt = asRecord(rawOpt);
              if (!opt) continue;
              const optId = typeof opt['id'] === 'string' && opt['id'] ? opt['id'] : `opt-exam-${idx + 1}-${bIdx + 1}-${oIdx + 1}`;
              const optText = typeof opt['text'] === 'string' ? opt['text'] : '';
              options.push({ id: optId, text: optText });
            }
          }

          while (options.length < 2) {
            const fallbackOptId = `opt-exam-${idx + 1}-${bIdx + 1}-${options.length + 1}`;
            options.push({ id: fallbackOptId, text: options.length === 0 ? 'goes' : 'go' });
          }

          const correctOptId =
            (itemSol && typeof itemSol[blankId] === 'string' && itemSol[blankId]) ||
            options[0]?.id ||
            '';

          blanks.push({
            id: blankId,
            options,
            correctOptionId: correctOptId,
          });
        }
      }

      if (blanks.length === 0) {
        const bId = `blank-exam-${idx + 1}-1`;
        const o1 = { id: `opt-exam-${idx + 1}-1-1`, text: 'goes' };
        const o2 = { id: `opt-exam-${idx + 1}-1-2`, text: 'go' };
        blanks.push({
          id: bId,
          options: [o1, o2],
          correctOptionId: o1.id,
        });
      }

      items.push({
        id: itemId,
        prompt,
        blanks,
        weight,
      });
    }

    if (items.length > 0) return items;
  }

  return [
    {
      id: DEFAULT_EXAM_ITEM1_ID,
      prompt: `The {{${DEFAULT_EXAM_BLANK1_ID}}} is sleeping.`,
      blanks: [
        {
          id: DEFAULT_EXAM_BLANK1_ID,
          options: [
            { id: DEFAULT_EXAM_OPT1A_ID, text: 'cat' },
            { id: DEFAULT_EXAM_OPT1B_ID, text: 'dog' },
          ],
          correctOptionId: DEFAULT_EXAM_OPT1A_ID,
        },
      ],
      weight: '50',
    },
    {
      id: DEFAULT_EXAM_ITEM2_ID,
      prompt: `She {{${DEFAULT_EXAM_BLANK2_ID}}} to school.`,
      blanks: [
        {
          id: DEFAULT_EXAM_BLANK2_ID,
          options: [
            { id: DEFAULT_EXAM_OPT2A_ID, text: 'goes' },
            { id: DEFAULT_EXAM_OPT2B_ID, text: 'go' },
          ],
          correctOptionId: DEFAULT_EXAM_OPT2A_ID,
        },
      ],
      weight: '50',
    },
  ];
}

export function balanceExamWeights(items: FormSentenceItem[]): FormSentenceItem[] {
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

export function buildFillBlankPayloadItems(fbItems: FormSentenceItem[]): {
  items: Array<{
    id: string;
    prompt: string;
    blanks: Array<{
      id: string;
      options: Array<{ id: string; text: string }>;
    }>;
  }>;
  answerKeyItems: Record<string, Record<string, string>>;
} {
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
    const trimmedPrompt = item.prompt.trim();
    if (!trimmedPrompt) {
      throw new Error(`La oración ${idx + 1} no puede tener texto vacío`);
    }
    if (!item.blanks || item.blanks.length === 0) {
      throw new Error(`La oración ${idx + 1} debe tener al menos un espacio para completar`);
    }

    const itemId = item.id || generateUuid();
    const blanksPayload: Array<{
      id: string;
      options: Array<{ id: string; text: string }>;
    }> = [];
    const itemAnswers: Record<string, string> = {};

    for (const [bIdx, blank] of item.blanks.entries()) {
      const blankId = blank.id || generateUuid();
      if (!blank.options || blank.options.length < 2) {
        throw new Error(
          `El espacio ${bIdx + 1} de la oración ${idx + 1} debe tener al menos 2 opciones`,
        );
      }
      if (blank.options.length > 6) {
        throw new Error(
          `El espacio ${bIdx + 1} de la oración ${idx + 1} no puede tener más de 6 opciones`,
        );
      }

      const seenTexts = new Set<string>();
      const optionsPayload: Array<{ id: string; text: string }> = [];

      for (const [oIdx, opt] of blank.options.entries()) {
        const optText = opt.text.trim();
        if (!optText) {
          throw new Error(
            `La opción ${oIdx + 1} del espacio ${bIdx + 1} de la oración ${idx + 1} no puede estar vacía`,
          );
        }
        const lower = optText.toLowerCase();
        if (seenTexts.has(lower)) {
          throw new Error(
            `Las opciones del espacio ${bIdx + 1} de la oración ${idx + 1} deben ser diferentes entre sí`,
          );
        }
        seenTexts.add(lower);
        optionsPayload.push({
          id: opt.id || generateUuid(),
          text: optText,
        });
      }

      const matchedOpt =
        optionsPayload.find((o) => o.id === blank.correctOptionId) || optionsPayload[0];
      if (!matchedOpt) {
        throw new Error(
          `Debes seleccionar la opción correcta para el espacio ${bIdx + 1} de la oración ${idx + 1}`,
        );
      }

      blanksPayload.push({
        id: blankId,
        options: optionsPayload,
      });
      itemAnswers[blankId] = matchedOpt.id;
    }

    const promptWithMarkers = buildSentencePromptWithMarkers(
      trimmedPrompt,
      blanksPayload.map((b) => ({
        id: b.id,
        options: b.options,
        correctOptionId: itemAnswers[b.id] ?? b.options[0]?.id ?? '',
      })),
    );

    itemsPayload.push({
      id: itemId,
      prompt: promptWithMarkers,
      blanks: blanksPayload,
    });

    answerKeyItems[itemId] = itemAnswers;
  }

  return { items: itemsPayload, answerKeyItems };
}

export function buildExamPayloadItems(examItems: FormSentenceItem[]): {
  items: Array<{
    id: string;
    weight: number;
    prompt: string;
    blanks: Array<{
      id: string;
      options: Array<{ id: string; text: string }>;
    }>;
  }>;
  answerKeyItems: Record<string, Record<string, string>>;
} {
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
    const trimmedPrompt = item.prompt.trim();
    if (!trimmedPrompt) {
      throw new Error(`La oración ${idx + 1} no puede tener texto vacío`);
    }
    if (!item.blanks || item.blanks.length === 0) {
      throw new Error(`La oración ${idx + 1} debe tener al menos un espacio para completar`);
    }

    const itemId = item.id || generateUuid();
    const blanksPayload: Array<{
      id: string;
      options: Array<{ id: string; text: string }>;
    }> = [];
    const itemAnswers: Record<string, string> = {};

    for (const [bIdx, blank] of item.blanks.entries()) {
      const blankId = blank.id || generateUuid();
      if (!blank.options || blank.options.length < 2) {
        throw new Error(
          `El espacio ${bIdx + 1} de la oración ${idx + 1} debe tener al menos 2 opciones`,
        );
      }
      if (blank.options.length > 6) {
        throw new Error(
          `El espacio ${bIdx + 1} de la oración ${idx + 1} no puede tener más de 6 opciones`,
        );
      }

      const seenTexts = new Set<string>();
      const optionsPayload: Array<{ id: string; text: string }> = [];

      for (const [oIdx, opt] of blank.options.entries()) {
        const optText = opt.text.trim();
        if (!optText) {
          throw new Error(
            `La opción ${oIdx + 1} del espacio ${bIdx + 1} de la oración ${idx + 1} no puede estar vacía`,
          );
        }
        const lower = optText.toLowerCase();
        if (seenTexts.has(lower)) {
          throw new Error(
            `Las opciones del espacio ${bIdx + 1} de la oración ${idx + 1} deben ser diferentes entre sí`,
          );
        }
        seenTexts.add(lower);
        optionsPayload.push({
          id: opt.id || generateUuid(),
          text: optText,
        });
      }

      const matchedOpt =
        optionsPayload.find((o) => o.id === blank.correctOptionId) || optionsPayload[0];
      if (!matchedOpt) {
        throw new Error(
          `Debes seleccionar la opción correcta para el espacio ${bIdx + 1} de la oración ${idx + 1}`,
        );
      }

      blanksPayload.push({
        id: blankId,
        options: optionsPayload,
      });
      itemAnswers[blankId] = matchedOpt.id;
    }

    const promptWithMarkers = buildSentencePromptWithMarkers(
      trimmedPrompt,
      blanksPayload.map((b) => ({
        id: b.id,
        options: b.options,
        correctOptionId: itemAnswers[b.id] ?? b.options[0]?.id ?? '',
      })),
    );

    const parsedWeight = parseFloat(item.weight || '0');

    itemsPayload.push({
      id: itemId,
      weight: parsedWeight,
      prompt: promptWithMarkers,
      blanks: blanksPayload,
    });

    answerKeyItems[itemId] = itemAnswers;
  }

  return { items: itemsPayload, answerKeyItems };
}

function parseInitialMatchPairs(
  cfg: unknown,
  ak: unknown,
): Array<{ leftText: string; rightText: string }> {
  const rec = asRecord(cfg);
  if (rec && rec['mechanic'] === 'match') {
    const settings = asRecord(rec['settings']);
    if (settings && Array.isArray(settings['left']) && Array.isArray(settings['right'])) {
      const left = settings['left'].filter(isIdTextItem);
      const right = settings['right'].filter(isIdTextItem);
      const akRec = asRecord(ak);
      const sol = akRec ? asRecord(akRec['solution']) : null;
      const rawPairs = sol ? asRecord(sol['pairs']) : null;
      const pairs: Record<string, string> = {};
      if (rawPairs) {
        for (const [k, v] of Object.entries(rawPairs)) {
          if (typeof v === 'string') pairs[k] = v;
        }
      }
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
      const words = settings['tokens'].filter(isTextItem).map((t) => t.text);
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
      const targets = settings['targets'].filter(isIdTextItem);
      const objects = settings['objects'].filter(isIdTextItem);
      const akRec = asRecord(ak);
      const sol = akRec ? asRecord(akRec['solution']) : null;
      const rawPlacements = sol ? asRecord(sol['placements']) : null;
      const placements: Record<string, string> = {};
      if (rawPlacements) {
        for (const [k, v] of Object.entries(rawPlacements)) {
          if (typeof v === 'string') placements[k] = v;
        }
      }
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
      const cards = settings['cards'].filter(isIdTextItem);
      const cardMap = new Map(cards.map((c) => [c.id, c.text]));
      const akRec = asRecord(ak);
      const sol = akRec ? asRecord(akRec['solution']) : null;
      if (sol && Array.isArray(sol['pairs'])) {
        const pairs = sol['pairs'].filter(isStringPair);
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
      const questions = settings['questions'].filter(isTimedQuestion);
      const akRec = asRecord(ak);
      const sol = akRec ? asRecord(akRec['solution']) : null;
      const rawChoices = sol ? asRecord(sol['choices']) : null;
      const choices: Record<string, string> = {};
      if (rawChoices) {
        for (const [k, v] of Object.entries(rawChoices)) {
          if (typeof v === 'string') choices[k] = v;
        }
      }
      const parsed = questions.map((q) => {
        const opt1 = q.options[0]?.text || 'Opción 1';
        const opt2 = q.options[1]?.text || 'Opción 2';
        const correctOptId = choices[q.id];
        const correct: 'opt1' | 'opt2' = correctOptId === q.options[1]?.id ? 'opt2' : 'opt1';
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

export function ActivityEditorComponent({
  initialActivity,
  onActivityUpdated,
}: ActivityEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(initialActivity?.id);
  const initialCfg = initialActivity?.config;
  const initialAk = initialActivity?.answerKey;
  const rawMechanic = getStringProp(initialCfg, 'mechanic', 'match');
  const initialMechanic: GameMechanicType = isGameMechanicType(rawMechanic) ? rawMechanic : 'match';

  // Core metadata
  const [title, setTitle] = useState(initialActivity?.title ?? '');
  const [level, setLevel] = useState<Level>(initialActivity?.level ?? Level.A1);
  const [type, setType] = useState<ActivityType>(
    initialActivity?.type ?? ActivityType.fill_blank,
  );
  const [currentStatus, setCurrentStatus] = useState<ActivityStatus>(
    initialActivity?.status ?? ActivityStatus.draft,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({});
  const [previewRecordingNotice, setPreviewRecordingNotice] = useState(false);
  const changePreviewAnswer = (itemId: string, answer: unknown) => {
    setPreviewAnswers((previous) => ({ ...previous, [itemId]: answer }));
  };
  const openPreview = () => {
    setPreviewAnswers({});
    setPreviewRecordingNotice(false);
    setIsPreviewOpen(true);
  };
  const speakPreview = isPreviewOpen &&
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    (window.speechSynthesis.getVoices().length > 0 ||
      !("onvoiceschanged" in window.speechSynthesis))
      ? speak
      : undefined;
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

  const createDefaultBlank = (): FormBlank => {
    const blankId = generateUuid();
    const opt1Id = generateUuid();
    const opt2Id = generateUuid();
    return {
      id: blankId,
      options: [
        { id: opt1Id, text: '' },
        { id: opt2Id, text: '' },
      ],
      correctOptionId: opt1Id,
    };
  };

  const createDefaultSentence = (weight?: string): FormSentenceItem => {
    const b = createDefaultBlank();
    return {
      id: generateUuid(),
      prompt: `The cat {{${b.id}}} sleeping.`,
      blanks: [b],
      ...(weight !== undefined ? { weight } : {}),
    };
  };

  const handleAddBlank = (itemIdx: number, isExam: boolean) => {
    const newBlank = createDefaultBlank();
    const updateList = (prev: FormSentenceItem[]) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        return {
          ...it,
          blanks: [...it.blanks, newBlank],
          prompt: `${it.prompt} {{${newBlank.id}}}`.trim(),
        };
      });
    if (isExam) setExamItems(updateList);
    else setFbItems(updateList);
  };

  const handleRemoveBlank = (itemIdx: number, blankIdx: number, isExam: boolean) => {
    const updateList = (prev: FormSentenceItem[]) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        const targetBlank = it.blanks[blankIdx];
        const updatedBlanks = it.blanks.filter((_, bI) => bI !== blankIdx);
        const updatedPrompt = targetBlank
          ? it.prompt.replace(`{{${targetBlank.id}}}`, '').replace(/\s+/g, ' ').trim()
          : it.prompt;
        return {
          ...it,
          blanks: updatedBlanks,
          prompt: updatedPrompt,
        };
      });
    if (isExam) setExamItems(updateList);
    else setFbItems(updateList);
  };

  const handleAddOption = (itemIdx: number, blankIdx: number, isExam: boolean) => {
    const newOpt: FormOption = { id: generateUuid(), text: '' };
    const updateList = (prev: FormSentenceItem[]) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        const updatedBlanks = it.blanks.map((b, bI) => {
          if (bI !== blankIdx) return b;
          if (b.options.length >= 6) return b;
          return { ...b, options: [...b.options, newOpt] };
        });
        return { ...it, blanks: updatedBlanks };
      });
    if (isExam) setExamItems(updateList);
    else setFbItems(updateList);
  };

  const handleRemoveOption = (
    itemIdx: number,
    blankIdx: number,
    optIdx: number,
    isExam: boolean,
  ) => {
    const updateList = (prev: FormSentenceItem[]) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        const updatedBlanks = it.blanks.map((b, bI) => {
          if (bI !== blankIdx) return b;
          if (b.options.length <= 2) return b;
          const targetOpt = b.options[optIdx];
          const updatedOptions = b.options.filter((_, oI) => oI !== optIdx);
          let correctId = b.correctOptionId;
          if (targetOpt && correctId === targetOpt.id) {
            correctId = updatedOptions[0]?.id ?? '';
          }
          return { ...b, options: updatedOptions, correctOptionId: correctId };
        });
        return { ...it, blanks: updatedBlanks };
      });
    if (isExam) setExamItems(updateList);
    else setFbItems(updateList);
  };

  const handleOptionTextChange = (
    itemIdx: number,
    blankIdx: number,
    optIdx: number,
    text: string,
    isExam: boolean,
  ) => {
    const updateList = (prev: FormSentenceItem[]) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        const updatedBlanks = it.blanks.map((b, bI) => {
          if (bI !== blankIdx) return b;
          const updatedOptions = b.options.map((o, oI) => (oI === optIdx ? { ...o, text } : o));
          return { ...b, options: updatedOptions };
        });
        return { ...it, blanks: updatedBlanks };
      });
    if (isExam) setExamItems(updateList);
    else setFbItems(updateList);
  };

  const handleCorrectOptionChange = (
    itemIdx: number,
    blankIdx: number,
    optId: string,
    isExam: boolean,
  ) => {
    const updateList = (prev: FormSentenceItem[]) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        const updatedBlanks = it.blanks.map((b, bI) => {
          if (bI !== blankIdx) return b;
          return { ...b, correctOptionId: optId };
        });
        return { ...it, blanks: updatedBlanks };
      });
    if (isExam) setExamItems(updateList);
    else setFbItems(updateList);
  };

  const handlePromptChange = (itemIdx: number, prompt: string, isExam: boolean) => {
    const updateList = (prev: FormSentenceItem[]) =>
      prev.map((it, idx) => (idx === itemIdx ? { ...it, prompt } : it));
    if (isExam) setExamItems(updateList);
    else setFbItems(updateList);
  };

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
    if (isRecord(initialCfg) && Array.isArray(initialCfg.items)) {
      const items = initialCfg.items.filter(isRecord);
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
      const { items: itemsPayload, answerKeyItems } = buildFillBlankPayloadItems(fbItems);

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
        return;
      }
      for (let i = 0; i < oqQuestions.length; i++) {
        const q = oqQuestions[i];
        if (!q || !q.prompt.trim()) {
          setError(`La pregunta ${i + 1} no puede estar vacía`);
          return;
        }
      }
      const firstQ = oqQuestions[0];
      if (!firstQ) {
        setError('Debes agregar al menos una pregunta abierta');
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
      const { items: itemsPayload, answerKeyItems } = buildExamPayloadItems(examItems);

      config = {
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

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      type: ActivityType;
      level: Level;
      config: unknown;
      answerKey: unknown;
      expectedDurationSeconds: number | null;
      minPlausibleSeconds: number | null;
    }) => {
      if (isEditing && initialActivity?.id) {
        return apiFetch<ActivityEditor>(`/api/v1/activities/${initialActivity.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: payload.title,
            level: payload.level,
            config: payload.config,
            answerKey: payload.answerKey,
            expectedDurationSeconds: payload.expectedDurationSeconds,
            minPlausibleSeconds: payload.minPlausibleSeconds,
          }),
          schema: ActivityEditorSchema,
        });
      }
      return apiFetch<ActivityEditor>('/api/v1/activities', {
        method: 'POST',
        body: JSON.stringify(payload),
        schema: ActivityEditorSchema,
      });
    },
    onSuccess: (data) => {
      setCurrentStatus(data.status);
      onActivityUpdated?.(data);
      queryClient.invalidateQueries({ queryKey: ['teacher', 'activities'] });
      if (initialActivity?.id) {
        queryClient.setQueryData(['teacher', 'activity', initialActivity.id], data);
        setSuccess('Actividad guardada correctamente');
      } else {
        setSuccess('Actividad creada exitosamente');
        router.push(`/actividades/${data.id}`);
      }
      if (data.weightsAdjusted) setWeightsAdjustedNotice(true);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al guardar la actividad');
      }
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch<ActivityEditor>(`/api/v1/activities/${id}/publish`, {
        method: 'POST',
        schema: ActivityEditorSchema,
      });
    },
    onSuccess: (published) => {
      setCurrentStatus(ActivityStatus.published);
      onActivityUpdated?.(published);
      if (initialActivity?.id) {
        queryClient.setQueryData(['teacher', 'activity', initialActivity.id], published);
      }
      queryClient.invalidateQueries({ queryKey: ['teacher', 'activities'] });
      setSuccess('¡Actividad publicada exitosamente! Ya está disponible en el catálogo.');
      router.refresh();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'EXAM_MIN_ITEMS') {
          setError('Un examen debe tener al menos 2 oraciones para ser publicado.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Error al publicar la actividad');
      }
    },
  });

  const isSaving = saveMutation.isPending || publishMutation.isPending;

  const handleSave = () => {
    setError(null);
    setSuccess(null);
    setWeightsAdjustedNotice(false);

    try {
      const payload = buildPayload();
      if (!payload) return;
      saveMutation.mutate(payload);
    } catch (err: unknown) {
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al guardar la actividad');
      }
    }
  };

  const handlePublish = () => {
    if (!initialActivity?.id) return;
    setError(null);
    setSuccess(null);
    publishMutation.mutate(initialActivity.id);
  };

  return (
    <div className="origami-shell mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center gap-2 origami-meta">
        <Link
          href="/actividades"
          className="origami-button origami-button--text"
        >
          Catálogo de Actividades
        </Link>
        <span>/</span>
        <span className="text-(--origami-text-primary) font-medium">
          {isEditing ? title || "Sin título" : "Nueva actividad"}
        </span>
      </div>

      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-(--origami-border-subtle) pb-5">
        <div>
          <h1 className="origami-page-title">
            {isEditing ? "Editor de actividad" : "Nueva actividad"}
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span
              className={`origami-state text-sm font-extrabold ${
                currentStatus === ActivityStatus.published
                  ? "origami-state--success"
                  : currentStatus === ActivityStatus.archived
                    ? "origami-state--warning"
                    : ""
              }`}
            >
              {currentStatus === ActivityStatus.published
                ? "Publicada"
                : currentStatus === ActivityStatus.archived
                  ? "Archivada"
                  : "Borrador"}
            </span>
            {isEditing && (
              <span className="origami-meta">
                Versión {initialActivity?.version}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPreview}
            className="origami-button origami-button--secondary"
          >
            Previsualizar
          </button>

          {isEditing && currentStatus === ActivityStatus.draft && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="origami-button origami-button--secondary"
            >
              Publicar
            </button>
          )}

          {currentStatus !== ActivityStatus.archived && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="origami-button"
            >
              {isSaving
                ? "Guardando…"
                : isEditing
                  ? "Guardar cambios"
                  : "Crear borrador"}
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div role="alert" className="origami-state origami-state--error">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="origami-state origami-state--success">
          {success}
        </div>
      )}

      {weightsAdjustedNotice && (
        <div role="status" className="origami-state">
          Los pesos de las oraciones del examen fueron ajustados automáticamente
          en décimas para sumar exactamente 100.0%.
        </div>
      )}

      {/* Metadata Form */}
      <section className="origami-card space-y-5">
        <h2 className="origami-section-title border-b border-(--origami-border-subtle) pb-2">
          Información básica
        </h2>

        {/* Title */}
        <div>
          <label htmlFor="activity-title" className="origami-label mb-1 block">
            Título de la actividad *
          </label>
          <input
            id="activity-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Ej. Simple Present vs Continuous"
            className="origami-field"
          />
          <p className="origami-meta mt-1">{title.length}/100 caracteres</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Level */}
          <div>
            <label
              htmlFor="activity-level"
              className="origami-label mb-1 block"
            >
              Nivel pedagógico *
            </label>
            <select
              id="activity-level"
              value={level}
              onChange={(e) => {
                if (isLevel(e.target.value)) setLevel(e.target.value);
              }}
              className="origami-field"
            >
              <option value={Level.A1}>A1 — Principiante inicial</option>
              <option value={Level.A2}>A2 — Principiante elemental</option>
              <option value={Level.B1}>B1 — Intermedio</option>
              <option value={Level.B2}>B2 — Intermedio alto</option>
            </select>
          </div>

          {/* Type Selector (only before creation) */}
          <div>
            <label htmlFor="activity-type" className="origami-label mb-1 block">
              Tipo de actividad
            </label>
            <select
              id="activity-type"
              value={type}
              disabled={isEditing}
              onChange={(e) => {
                if (isActivityType(e.target.value)) setType(e.target.value);
              }}
              className="origami-field"
            >
              <option value={ActivityType.fill_blank}>
                Rellenar huecos (Fill in the blanks)
              </option>
              <option value={ActivityType.open_question}>
                Pregunta abierta (Open question)
              </option>
              <option value={ActivityType.speaking}>
                Expresión oral (Speaking)
              </option>
              <option value={ActivityType.game}>Microjuego (Game)</option>
              <option value={ActivityType.exam}>Examen (Exam)</option>
            </select>
          </div>
        </div>

        {/* Durations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label htmlFor="exp-duration" className="origami-label mb-1 block">
              Duración esperada (segundos, opcional)
            </label>
            <input
              id="exp-duration"
              type="number"
              min="1"
              value={expectedDuration}
              onChange={(e) => setExpectedDuration(e.target.value)}
              placeholder="Default según tipo"
              className="origami-field"
            />
          </div>

          <div>
            <label htmlFor="min-duration" className="origami-label mb-1 block">
              Mínimo plausible (segundos)
            </label>
            <input
              id="min-duration"
              type="number"
              min="1"
              value={type === ActivityType.speaking ? "2" : minPlausible}
              disabled={type === ActivityType.speaking}
              onChange={(e) => setMinPlausible(e.target.value)}
              placeholder={
                type === ActivityType.speaking
                  ? "2 (fijo)"
                  : "Default según tipo"
              }
              className="origami-field"
            />
            {type === ActivityType.speaking && (
              <p className="origami-meta mt-1">
                La duración mínima para Speaking es fija de 2 segundos.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Content Form by Type */}
      <section className="origami-card space-y-5">
        <h2 className="origami-section-title border-b border-(--origami-border-subtle) pb-2">
          Contenido de la actividad
        </h2>

        {/* FILL BLANK */}
        {type === ActivityType.fill_blank && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="fb-instructions"
                className="origami-label mb-1 block"
              >
                Instrucciones (opcional)
              </label>
              <input
                id="fb-instructions"
                type="text"
                value={fbInstructions}
                onChange={(e) => setFbInstructions(e.target.value)}
                maxLength={2000}
                placeholder="Ej. Selecciona la opción correcta para completar la oración."
                className="origami-field"
              />
            </div>

            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <h3 className="text-base font-extrabold">
                Oraciones con huecos ({fbItems.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setFbItems([...fbItems, createDefaultSentence()])
                }
                className="origami-button origami-button--text"
              >
                + Añadir oración
              </button>
            </div>

            {fbItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className="rounded-lg border border-(--origami-border-subtle) p-4 bg-(--origami-surface-soft) space-y-4"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-base font-extrabold">
                    Oración {idx + 1}
                  </h4>
                  {fbItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFbItems(fbItems.filter((_, i) => i !== idx))
                      }
                      className="origami-button origami-button--text text-(--origami-error-text)"
                      aria-label={`Eliminar oración ${idx + 1}`}
                    >
                      Eliminar oración
                    </button>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`fb-prompt-${idx}`}
                    className="origami-label mb-1 block"
                  >
                    Texto de la oración (los huecos se marcan con{" "}
                    <code>&#123;&#123;id&#125;&#125;</code>):
                  </label>
                  <textarea
                    id={`fb-prompt-${idx}`}
                    aria-label={`Texto con hueco oración ${idx + 1}`}
                    rows={2}
                    value={item.prompt}
                    onChange={(e) =>
                      handlePromptChange(idx, e.target.value, false)
                    }
                    className="origami-field font-mono"
                  />
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-(--origami-text-primary)">
                      Huecos de esta oración ({item.blanks.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddBlank(idx, false)}
                      className="origami-button origami-button--text"
                    >
                      + Añadir hueco
                    </button>
                  </div>

                  {item.blanks.map((blank, bIdx) => (
                    <div
                      key={blank.id || bIdx}
                      className="rounded-md border border-(--origami-border-subtle) bg-(--origami-surface-raised) p-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-(--origami-text-primary)">
                            Espacio {bIdx + 1}
                          </span>
                          <code className="text-[11px] bg-(--origami-surface-soft) text-(--origami-text-secondary) px-1.5 py-0.5 rounded font-mono">
                            &#123;&#123;{blank.id}&#125;&#125;
                          </code>
                        </div>
                        {item.blanks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBlank(idx, bIdx, false)}
                            className="origami-button origami-button--text text-(--origami-error-text)"
                            aria-label={`Eliminar espacio ${bIdx + 1} de oración ${idx + 1}`}
                          >
                            Eliminar espacio
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[11px] font-medium text-(--origami-text-secondary)">
                            Opciones ({blank.options.length}/6):
                          </span>
                          {blank.options.length < 6 && (
                            <button
                              type="button"
                              onClick={() => handleAddOption(idx, bIdx, false)}
                              className="origami-button origami-button--text"
                            >
                              + Opción
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {blank.options.map((opt, oIdx) => (
                            <div
                              key={opt.id || oIdx}
                              className="flex items-center gap-2 flex-wrap bg-(--origami-surface-soft) p-2 rounded border border-(--origami-border-subtle)"
                            >
                              <input
                                type="text"
                                aria-label={`Opción ${oIdx + 1} espacio ${bIdx + 1} oración ${idx + 1}`}
                                placeholder={`Opción ${oIdx + 1}`}
                                value={opt.text}
                                onChange={(e) =>
                                  handleOptionTextChange(
                                    idx,
                                    bIdx,
                                    oIdx,
                                    e.target.value,
                                    false,
                                  )
                                }
                                className="origami-field flex-1 min-w-24"
                              />
                              <label className="origami-label flex min-h-12 cursor-pointer items-center gap-2">
                                <input
                                  type="radio"
                                  className="size-5 shrink-0 accent-(--origami-primary)"
                                  name={`correct-fb-${item.id || idx}-${blank.id || bIdx}`}
                                  aria-label={`Marcar opción ${oIdx + 1} como correcta para espacio ${bIdx + 1} oración ${idx + 1}`}
                                  checked={blank.correctOptionId === opt.id}
                                  onChange={() =>
                                    handleCorrectOptionChange(
                                      idx,
                                      bIdx,
                                      opt.id,
                                      false,
                                    )
                                  }
                                />
                                Correcta
                              </label>
                              {blank.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveOption(idx, bIdx, oIdx, false)
                                  }
                                  className="origami-button origami-button--text text-(--origami-error-text)"
                                  aria-label={`Eliminar opción ${oIdx + 1} de espacio ${bIdx + 1} oración ${idx + 1}`}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EXAM */}
        {type === ActivityType.exam && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="exam-instructions"
                className="origami-label mb-1 block"
              >
                Instrucciones del examen (opcional)
              </label>
              <input
                id="exam-instructions"
                type="text"
                value={fbInstructions}
                onChange={(e) => setFbInstructions(e.target.value)}
                maxLength={2000}
                placeholder="Ej. Lee con atención cada oración y completa con la forma verbal correcta."
                className="origami-field"
              />
            </div>

            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-extrabold">
                  Oraciones del examen ({examItems.length})
                </h3>
                <p className="origami-meta">
                  Suma de pesos:{" "}
                  {examItems
                    .reduce(
                      (acc, it) => acc + (parseFloat(it.weight || "0") || 0),
                      0,
                    )
                    .toFixed(1)}
                  % (Debe sumar 100% para publicar)
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setExamItems(balanceExamWeights(examItems))}
                  className="origami-button origami-button--secondary"
                >
                  ⚖️ Balancear pesos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newItems = [...examItems, createDefaultSentence("0")];
                    setExamItems(balanceExamWeights(newItems));
                  }}
                  className="origami-button origami-button--text"
                >
                  + Añadir oración
                </button>
              </div>
            </div>

            {examItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className="rounded-lg border border-(--origami-border-subtle) p-4 bg-(--origami-surface-soft) space-y-4"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-base font-extrabold">
                    Oración {idx + 1} (Peso: {item.weight || "0"}%)
                  </h4>
                  {examItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const filtered = examItems.filter((_, i) => i !== idx);
                        setExamItems(balanceExamWeights(filtered));
                      }}
                      className="origami-button origami-button--text text-(--origami-error-text)"
                      aria-label={`Eliminar oración ${idx + 1}`}
                    >
                      Eliminar oración
                    </button>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`exam-w${idx + 1}`}
                    className="origami-label mb-1 block"
                  >
                    Peso de la oración (0-100%):
                  </label>
                  <input
                    id={`exam-w${idx + 1}`}
                    aria-label={`Peso de la oración ${idx + 1}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.weight ?? "0"}
                    onChange={(e) =>
                      setExamItems(
                        examItems.map((it, i) =>
                          i === idx ? { ...it, weight: e.target.value } : it,
                        ),
                      )
                    }
                    className="origami-field max-w-32"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`exam-prompt-${idx}`}
                    className="origami-label mb-1 block"
                  >
                    Texto de la oración (los huecos se marcan con{" "}
                    <code>&#123;&#123;id&#125;&#125;</code>):
                  </label>
                  <textarea
                    id={`exam-prompt-${idx}`}
                    aria-label={`Texto con hueco oración ${idx + 1}`}
                    rows={2}
                    value={item.prompt}
                    onChange={(e) =>
                      handlePromptChange(idx, e.target.value, true)
                    }
                    className="origami-field font-mono"
                  />
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-(--origami-text-primary)">
                      Huecos de esta oración ({item.blanks.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddBlank(idx, true)}
                      className="origami-button origami-button--text"
                    >
                      + Añadir hueco
                    </button>
                  </div>

                  {item.blanks.map((blank, bIdx) => (
                    <div
                      key={blank.id || bIdx}
                      className="rounded-md border border-(--origami-border-subtle) bg-(--origami-surface-raised) p-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-(--origami-text-primary)">
                            Espacio {bIdx + 1}
                          </span>
                          <code className="text-[11px] bg-(--origami-surface-soft) text-(--origami-text-secondary) px-1.5 py-0.5 rounded font-mono">
                            &#123;&#123;{blank.id}&#125;&#125;
                          </code>
                        </div>
                        {item.blanks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBlank(idx, bIdx, true)}
                            className="origami-button origami-button--text text-(--origami-error-text)"
                            aria-label={`Eliminar espacio ${bIdx + 1} de oración ${idx + 1}`}
                          >
                            Eliminar espacio
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[11px] font-medium text-(--origami-text-secondary)">
                            Opciones ({blank.options.length}/6):
                          </span>
                          {blank.options.length < 6 && (
                            <button
                              type="button"
                              onClick={() => handleAddOption(idx, bIdx, true)}
                              className="origami-button origami-button--text"
                            >
                              + Opción
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {blank.options.map((opt, oIdx) => (
                            <div
                              key={opt.id || oIdx}
                              className="flex items-center gap-2 flex-wrap bg-(--origami-surface-soft) p-2 rounded border border-(--origami-border-subtle)"
                            >
                              <input
                                type="text"
                                aria-label={`Opción ${oIdx + 1} espacio ${bIdx + 1} oración ${idx + 1}`}
                                placeholder={`Opción ${oIdx + 1}`}
                                value={opt.text}
                                onChange={(e) =>
                                  handleOptionTextChange(
                                    idx,
                                    bIdx,
                                    oIdx,
                                    e.target.value,
                                    true,
                                  )
                                }
                                className="origami-field flex-1 min-w-24"
                              />
                              <label className="origami-label flex min-h-12 cursor-pointer items-center gap-2">
                                <input
                                  type="radio"
                                  className="size-5 shrink-0 accent-(--origami-primary)"
                                  name={`correct-exam-${item.id || idx}-${blank.id || bIdx}`}
                                  aria-label={`Marcar opción ${oIdx + 1} como correcta para espacio ${bIdx + 1} oración ${idx + 1}`}
                                  checked={blank.correctOptionId === opt.id}
                                  onChange={() =>
                                    handleCorrectOptionChange(
                                      idx,
                                      bIdx,
                                      opt.id,
                                      true,
                                    )
                                  }
                                />
                                Correcta
                              </label>
                              {blank.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveOption(idx, bIdx, oIdx, true)
                                  }
                                  className="origami-button origami-button--text text-(--origami-error-text)"
                                  aria-label={`Eliminar opción ${oIdx + 1} de espacio ${bIdx + 1} oración ${idx + 1}`}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OPEN QUESTION (RFC-01: multi-pregunta) */}
        {type === ActivityType.open_question && (
          <div className="space-y-6">
            <div>
              <label
                htmlFor="oq-instructions"
                className="origami-label mb-1 block"
              >
                Instrucciones generales de la actividad (opcional)
              </label>
              <input
                id="oq-instructions"
                type="text"
                placeholder="Ej. Responde a las siguientes preguntas en inglés con oraciones completas."
                value={oqInstructions}
                onChange={(e) => setOqInstructions(e.target.value)}
                maxLength={2000}
                className="origami-field"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-(--origami-text-primary)">
                  Preguntas abiertas ({oqQuestions.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setOqQuestions((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        prompt: "",
                        rubric: "",
                        maxLength: "2000",
                      },
                    ])
                  }
                  className="origami-button origami-button--secondary"
                >
                  <span>+</span>
                  <span>Agregar otra pregunta</span>
                </button>
              </div>

              {oqQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-4 rounded-xl border border-(--origami-border-subtle) bg-(--origami-surface-soft) space-y-3 relative"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black uppercase text-(--origami-text-secondary) tracking-wide">
                      Pregunta #{idx + 1}
                    </span>
                    {oqQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setOqQuestions((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="origami-button origami-button--text text-(--origami-error-text)"
                        aria-label={`Eliminar pregunta ${idx + 1}`}
                      >
                        Eliminar pregunta
                      </button>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`oq-prompt-${idx}`}
                      className="origami-label mb-1 block"
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
                            i === idx
                              ? { ...item, prompt: e.target.value }
                              : item,
                          ),
                        )
                      }
                      maxLength={5000}
                      placeholder="Escribe la consigna en inglés..."
                      className="origami-field"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={`oq-rubric-${idx}`}
                        className="origami-label mb-1 block"
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
                              i === idx
                                ? { ...item, rubric: e.target.value }
                                : item,
                            ),
                          )
                        }
                        maxLength={2000}
                        placeholder="Ej. Vocabulario y tiempos verbales"
                        className="origami-field"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`oq-max-len-${idx}`}
                        className="origami-label mb-1 block"
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
                              i === idx
                                ? { ...item, maxLength: e.target.value }
                                : item,
                            ),
                          )
                        }
                        className="origami-field"
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
              <label htmlFor="sp-prompt" className="origami-label mb-1 block">
                Consigna de grabación *
              </label>
              <textarea
                id="sp-prompt"
                rows={3}
                value={spPrompt}
                onChange={(e) => setSpPrompt(e.target.value)}
                maxLength={5000}
                className="origami-field"
              />
            </div>

            <div>
              <label htmlFor="sp-url" className="origami-label mb-1 block">
                URL de audio de ejemplo (HTTPS, opcional)
              </label>
              <input
                id="sp-url"
                type="url"
                value={spExampleUrl}
                onChange={(e) => setSpExampleUrl(e.target.value)}
                placeholder="https://assets.upwardenglish.edu/samples/intro.mp3"
                className="origami-field"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sp-min-dur"
                  className="origami-label mb-1 block"
                >
                  Duración mínima requerida
                </label>
                <input
                  id="sp-min-dur"
                  type="number"
                  value={2}
                  disabled
                  readOnly
                  className="origami-field"
                />
                <p className="origami-meta mt-1">
                  Fijo en 2 segundos según las especificaciones pedagógicas
                  (RF-5).
                </p>
              </div>

              <div>
                <label
                  htmlFor="sp-max-dur"
                  className="origami-label mb-1 block"
                >
                  Duración máxima de grabación (segundos, 2-300)
                </label>
                <input
                  id="sp-max-dur"
                  type="number"
                  min="2"
                  max="300"
                  value={spMaxDuration}
                  onChange={(e) => setSpMaxDuration(e.target.value)}
                  className="origami-field"
                />
              </div>
            </div>
          </div>
        )}

        {/* GAME: MECHANIC & SETTINGS */}
        {type === ActivityType.game && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="game-mechanic"
                className="origami-label mb-1 block"
              >
                Mecánica del microjuego{" "}
                {isEditing && "(no modificable tras creación)"}
              </label>
              <select
                id="game-mechanic"
                value={gameMechanic}
                disabled={isEditing}
                onChange={(e) => {
                  if (isGameMechanicType(e.target.value))
                    setGameMechanic(e.target.value);
                }}
                className="origami-field"
              >
                <option value="order_words">
                  Ordenar palabras (Order words)
                </option>
                <option value="match">Emparejar (Match)</option>
                <option value="drag_drop">
                  Arrastrar y soltar (Drag & drop)
                </option>
                <option value="memory">Memoria (Memory)</option>
                <option value="timed_choice">
                  Opción contra reloj (Timed choice)
                </option>
              </select>
              {isEditing && (
                <p className="origami-meta mt-1">
                  La mecánica de un microjuego no se puede cambiar después de su
                  creación.
                </p>
              )}
            </div>

            {/* 1. ORDER WORDS */}
            {gameMechanic === "order_words" && (
              <div className="rounded-lg bg-(--origami-surface-soft) border border-(--origami-border-subtle) p-4 space-y-2">
                <label
                  htmlFor="order-words"
                  className="origami-label mb-1 block"
                >
                  Oración a ordenar (palabras separadas por espacios) *
                </label>
                <input
                  id="order-words"
                  type="text"
                  value={orderWordsText}
                  onChange={(e) => setOrderWordsText(e.target.value)}
                  placeholder="Ej. The dog plays in the garden"
                  className="origami-field"
                />
                <p className="origami-meta">
                  El alumno recibirá las palabras desordenadas y deberá
                  organizarlas en el orden exacto.
                </p>
              </div>
            )}

            {/* 2. MATCH */}
            {gameMechanic === "match" && (
              <div className="rounded-lg bg-(--origami-surface-soft) border border-(--origami-border-subtle) p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-extrabold">
                      Parejas a emparejar
                    </h3>
                    <p className="origami-meta">Mínimo 2 parejas.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMatchPairs([
                        ...matchPairs,
                        { leftText: "", rightText: "" },
                      ])
                    }
                    className="origami-button origami-button--text"
                  >
                    + Añadir pareja
                  </button>
                </div>
                <div className="space-y-2">
                  {matchPairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 flex-wrap"
                    >
                      <input
                        id={`match-pair-left-${idx}`}
                        aria-label={`Elemento izquierdo pareja ${idx + 1}`}
                        type="text"
                        placeholder="Elemento izquierdo (ej. Apple)"
                        value={pair.leftText}
                        onChange={(e) =>
                          setMatchPairs(
                            matchPairs.map((p, i) =>
                              i === idx
                                ? { ...p, leftText: e.target.value }
                                : p,
                            ),
                          )
                        }
                        className="origami-field flex-1 min-w-24"
                      />
                      <span className="text-xs text-(--origami-text-secondary)">
                        ↔
                      </span>
                      <input
                        id={`match-pair-right-${idx}`}
                        aria-label={`Elemento derecho pareja ${idx + 1}`}
                        type="text"
                        placeholder="Elemento derecho (ej. Manzana)"
                        value={pair.rightText}
                        onChange={(e) =>
                          setMatchPairs(
                            matchPairs.map((p, i) =>
                              i === idx
                                ? { ...p, rightText: e.target.value }
                                : p,
                            ),
                          )
                        }
                        className="origami-field flex-1 min-w-24"
                      />
                      <button
                        type="button"
                        disabled={matchPairs.length <= 2}
                        onClick={() =>
                          setMatchPairs(matchPairs.filter((_, i) => i !== idx))
                        }
                        className="origami-button origami-button--text text-(--origami-error-text)"
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
            {gameMechanic === "drag_drop" && (
              <div className="rounded-lg bg-(--origami-surface-soft) border border-(--origami-border-subtle) p-4 space-y-4">
                {/* Targets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-extrabold">
                        Categorías / Destinos
                      </h3>
                      <p className="origami-meta">Mínimo 2 destinos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDragTargets([...dragTargets, { name: "" }])
                      }
                      className="origami-button origami-button--text"
                    >
                      + Añadir categoría
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dragTargets.map((target, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 flex-wrap"
                      >
                        <span className="text-xs text-(--origami-text-secondary) w-16">
                          Cat. {idx + 1}:
                        </span>
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
                          className="origami-field flex-1 min-w-24"
                        />
                        <button
                          type="button"
                          disabled={dragTargets.length <= 2}
                          onClick={() => {
                            setDragTargets(
                              dragTargets.filter((_, i) => i !== idx),
                            );
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
                          className="origami-button origami-button--text text-(--origami-error-text)"
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
                <div className="space-y-2 border-t border-(--origami-border-subtle) pt-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-extrabold">
                        Elementos a clasificar
                      </h3>
                      <p className="origami-meta">Mínimo 2 elementos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDragObjects([
                          ...dragObjects,
                          { text: "", targetIndex: 0 },
                        ])
                      }
                      className="origami-button origami-button--text"
                    >
                      + Añadir elemento
                    </button>
                  </div>
                  <div className="space-y-2">
                    {dragObjects.map((obj, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 flex-wrap"
                      >
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
                          className="origami-field flex-1 min-w-24"
                        />
                        <span className="origami-meta">→</span>
                        <select
                          id={`drag-target-select-${idx}`}
                          aria-label={`Categoría asignada para el elemento ${idx + 1}`}
                          value={obj.targetIndex}
                          onChange={(e) =>
                            setDragObjects(
                              dragObjects.map((o, i) =>
                                i === idx
                                  ? {
                                      ...o,
                                      targetIndex:
                                        parseInt(e.target.value, 10) || 0,
                                    }
                                  : o,
                              ),
                            )
                          }
                          className="origami-field sm:max-w-48"
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
                          onClick={() =>
                            setDragObjects(
                              dragObjects.filter((_, i) => i !== idx),
                            )
                          }
                          className="origami-button origami-button--text text-(--origami-error-text)"
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
            {gameMechanic === "memory" && (
              <div className="rounded-lg bg-(--origami-surface-soft) border border-(--origami-border-subtle) p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-extrabold">
                      Parejas de memoria
                    </h3>
                    <p className="origami-meta">
                      Mínimo 2 parejas (4 tarjetas en total).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMemoryPairs([
                        ...memoryPairs,
                        { card1Text: "", card2Text: "" },
                      ])
                    }
                    className="origami-button origami-button--text"
                  >
                    + Añadir pareja
                  </button>
                </div>
                <div className="space-y-2">
                  {memoryPairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 flex-wrap"
                    >
                      <input
                        id={`memory-card-1-${idx}`}
                        aria-label={`Tarjeta 1 pareja ${idx + 1}`}
                        type="text"
                        placeholder="Tarjeta 1 (ej. Dog)"
                        value={pair.card1Text}
                        onChange={(e) =>
                          setMemoryPairs(
                            memoryPairs.map((p, i) =>
                              i === idx
                                ? { ...p, card1Text: e.target.value }
                                : p,
                            ),
                          )
                        }
                        className="origami-field flex-1 min-w-24"
                      />
                      <span className="text-xs text-(--origami-text-secondary)">
                        ♥
                      </span>
                      <input
                        id={`memory-card-2-${idx}`}
                        aria-label={`Tarjeta 2 pareja ${idx + 1}`}
                        type="text"
                        placeholder="Tarjeta 2 (ej. Perro)"
                        value={pair.card2Text}
                        onChange={(e) =>
                          setMemoryPairs(
                            memoryPairs.map((p, i) =>
                              i === idx
                                ? { ...p, card2Text: e.target.value }
                                : p,
                            ),
                          )
                        }
                        className="origami-field flex-1 min-w-24"
                      />
                      <button
                        type="button"
                        disabled={memoryPairs.length <= 2}
                        onClick={() =>
                          setMemoryPairs(
                            memoryPairs.filter((_, i) => i !== idx),
                          )
                        }
                        className="origami-button origami-button--text text-(--origami-error-text)"
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
            {gameMechanic === "timed_choice" && (
              <div className="rounded-lg bg-(--origami-surface-soft) border border-(--origami-border-subtle) p-4 space-y-4">
                <div>
                  <label
                    htmlFor="timed-limit"
                    className="origami-label mb-1 block"
                  >
                    Tiempo límite por pregunta (segundos, 5-120) *
                  </label>
                  <input
                    id="timed-limit"
                    type="number"
                    min="5"
                    max="120"
                    value={timedChoiceLimit}
                    onChange={(e) => setTimedChoiceLimit(e.target.value)}
                    className="origami-field max-w-32"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-extrabold">
                        Preguntas contra reloj
                      </h3>
                      <p className="origami-meta">Mínimo 1 pregunta.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTimedQuestions([
                          ...timedQuestions,
                          { prompt: "", opt1: "", opt2: "", correct: "opt1" },
                        ])
                      }
                      className="origami-button origami-button--text"
                    >
                      + Añadir pregunta
                    </button>
                  </div>

                  {timedQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-(--origami-border-subtle) bg-(--origami-surface-raised) p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-(--origami-text-primary)">
                          Pregunta {idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={timedQuestions.length <= 1}
                          onClick={() =>
                            setTimedQuestions(
                              timedQuestions.filter((_, i) => i !== idx),
                            )
                          }
                          className="origami-button origami-button--text text-(--origami-error-text)"
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
                              i === idx
                                ? { ...item, prompt: e.target.value }
                                : item,
                            ),
                          )
                        }
                        className="origami-field"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            id={`tc-opt1-${idx}`}
                            aria-label={`Opción 1 pregunta ${idx + 1}`}
                            type="text"
                            placeholder="Opción 1"
                            value={q.opt1}
                            onChange={(e) =>
                              setTimedQuestions(
                                timedQuestions.map((item, i) =>
                                  i === idx
                                    ? { ...item, opt1: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="origami-field flex-1 min-w-24"
                          />
                          <label className="origami-label flex min-h-12 cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              className="size-5 shrink-0 accent-(--origami-primary)"
                              name={`tc-correct-${idx}`}
                              aria-label={`Marcar opción 1 como correcta para pregunta ${idx + 1}`}
                              checked={q.correct === "opt1"}
                              onChange={() =>
                                setTimedQuestions(
                                  timedQuestions.map((item, i) =>
                                    i === idx
                                      ? { ...item, correct: "opt1" }
                                      : item,
                                  ),
                                )
                              }
                            />
                            Correcta
                          </label>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            id={`tc-opt2-${idx}`}
                            aria-label={`Opción 2 pregunta ${idx + 1}`}
                            type="text"
                            placeholder="Opción 2"
                            value={q.opt2}
                            onChange={(e) =>
                              setTimedQuestions(
                                timedQuestions.map((item, i) =>
                                  i === idx
                                    ? { ...item, opt2: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="origami-field flex-1 min-w-24"
                          />
                          <label className="origami-label flex min-h-12 cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              className="size-5 shrink-0 accent-(--origami-primary)"
                              name={`tc-correct-${idx}`}
                              aria-label={`Marcar opción 2 como correcta para pregunta ${idx + 1}`}
                              checked={q.correct === "opt2"}
                              onChange={() =>
                                setTimedQuestions(
                                  timedQuestions.map((item, i) =>
                                    i === idx
                                      ? { ...item, correct: "opt2" }
                                      : item,
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
      </section>

      {/* Activity Preview Modal (ENG-039, RF-16 SPEC-04, RF-12 SPEC-05) */}
      <AccessibleModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Previsualización Docente"
        description="Vista previa: no se guardan respuestas (ENG-039). Modo interactivo de prueba sin alterar métricas."
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap">
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Selector de tema para previsualización"
            >
              <button
                type="button"
                onClick={() => setPreviewTheme("kids")}
                aria-pressed={previewTheme === "kids"}
                className={`origami-button origami-button--secondary ${previewTheme === "kids" ? "origami-selected" : ""}`}
              >
                Kids
              </button>
              <button
                type="button"
                onClick={() => setPreviewTheme("teens")}
                aria-pressed={previewTheme === "teens"}
                className={`origami-button origami-button--secondary ${previewTheme === "teens" ? "origami-selected" : ""}`}
              >
                Teens
              </button>
            </div>
          </div>

          <div className="origami-card space-y-4" data-theme={previewTheme}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="origami-state">Nivel {level}</span>
              <span className="origami-meta">{activityTypeLabels[type]}</span>
            </div>
            <h3 className="origami-card-title">
              {title || "Actividad sin título"}
            </h3>

            {isPreviewOpen && (type === ActivityType.fill_blank || type === ActivityType.exam) && (
              <SentenceRenderer
                exam={type === ActivityType.exam}
                items={(type === ActivityType.exam ? examItems : fbItems).map((item) => ({
                  id: item.id,
                  prompt: buildSentencePromptWithMarkers(item.prompt, item.blanks),
                  weight: Number(item.weight) || 0,
                  blanks: item.blanks.map(({ id, options }) => ({ id, options })),
                }))}
                answers={previewAnswers}
                onAnswerChange={changePreviewAnswer}
                onSpeak={speakPreview}
              />
            )}

            {isPreviewOpen && type === ActivityType.open_question && (
              <OpenQuestionRenderer
                instructions={oqInstructions}
                items={oqQuestions.map(({ id, prompt, maxLength }) => {
                  const limit = Number(maxLength);
                  return {
                    id,
                    prompt,
                    maxLength: Number.isInteger(limit) && limit > 0 ? limit : 2000,
                  };
                })}
                answers={previewAnswers}
                onAnswerChange={changePreviewAnswer}
                onSpeak={speakPreview}
              />
            )}

            {isPreviewOpen && type === ActivityType.speaking && (
              <SpeakingRenderer
                prompt={spPrompt}
                onSpeak={speakPreview}
                recorder={{
                  mode: "preview",
                  onStart: () => setPreviewRecordingNotice(true),
                  notice: previewRecordingNotice
                    ? "El micrófono no se activa en la previsualización."
                    : undefined,
                }}
              />
            )}

            {isPreviewOpen && type === ActivityType.game &&
              (() => {
                let previewConfig: GamePublicConfig | null;
                try {
                  const payload = buildPayload();
                  if (
                    !payload ||
                    !isGamePublicConfig(payload.config) ||
                    !isGameAnswerKey(payload.answerKey)
                  ) {
                    previewConfig = null;
                  } else {
                    previewConfig = {
                      ...payload.config,
                      answerKey: payload.answerKey,
                    };
                  }
                } catch {
                  previewConfig = null;
                }

                if (!previewConfig) {
                  return (
                    <div className="origami-state space-y-2">
                      <p className="font-bold">
                        Previsualización de {gameMechanic}
                      </p>
                      <p className="origami-meta">
                        Completa los campos requeridos de la mecánica para
                        interactuar con la previsualización.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="min-w-0">
                    <GameRenderer
                      config={previewConfig}
                      previewMode={true}
                      theme={previewTheme}
                    />
                  </div>
                );
              })()}
          </div>

          <div className="flex justify-end border-t border-(--origami-border-subtle) pt-3">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="origami-button origami-button--secondary"
            >
              Cerrar previsualización
            </button>
          </div>
        </div>
      </AccessibleModal>
    </div>
  );
}
