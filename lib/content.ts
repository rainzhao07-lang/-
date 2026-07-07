// 内容数据的唯一入口。引擎与内容分离:运营者只改 /content 下的数据文件。
import breedsJson from "@/content/breeds.json";
import personasJson from "@/content/personas.json";
import questionsJson from "@/content/questions.json";
import type { BreedProfile, Persona, Question } from "./types";

export const breeds = breedsJson as unknown as Record<string, BreedProfile>;
export const personas = personasJson as Persona[];
export const questions = questionsJson as unknown as Question[];

export function personaById(id: string): Persona | undefined {
  return personas.find((p) => p.id === id);
}

export function breedByName(name: string, source: Record<string, BreedProfile> = breeds): BreedProfile | undefined {
  return Object.values(source).find((b) => b.name === name);
}
