import { describe, expect, it } from 'vitest';
import { speechSegments } from './speech';

describe('ERR-05: idioma de lectura', () => {
  it('separa la instrucción española de la frase inglesa tras dos puntos', () => {
    expect(speechSegments('Graba tu voz leyendo la oración: I like learning English')).toEqual([
      { text: 'Graba tu voz leyendo la oración:', lang: 'es-CO' },
      { text: 'I like learning English', lang: 'en-US' },
    ]);
  });
  it('conserva el idioma de instrucciones completas y títulos ingleses', () => {
    expect(speechSegments('Selecciona la respuesta correcta')).toEqual([{ text: 'Selecciona la respuesta correcta', lang: 'es-CO' }]);
    expect(speechSegments('Vocabulary Match: Animals & Objects')).toEqual([{ text: 'Vocabulary Match: Animals & Objects', lang: 'en-US' }]);
  });
});
