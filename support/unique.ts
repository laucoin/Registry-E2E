import { randomUUID } from 'node:crypto';

/** Un court suffixe aléatoire pour les noms qui doivent être uniques entre des scénarios qui s'exécutent en même temps. */
export const uid = (): string => randomUUID().slice(0, 8);
