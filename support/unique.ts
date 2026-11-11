import { randomInt, randomUUID } from 'node:crypto';

/** Un court suffixe aléatoire pour les noms qui doivent être uniques entre des scénarios qui s'exécutent en même temps. */
export const uid = (): string => randomUUID().slice(0, 8);

const letters = (count: number): string =>
	Array.from({ length: count }, () => String.fromCharCode(65 + randomInt(26))).join('');

/** Une plaque au format que le champ du formulaire impose (`AA-999-AA`), assez variée pour ne pas se répéter entre scénarios. */
export const licensePlate = (): string => `${letters(2)}-${String(randomInt(1000)).padStart(3, '0')}-${letters(2)}`;
