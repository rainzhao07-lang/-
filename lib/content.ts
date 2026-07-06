// 内容数据的唯一入口。引擎与内容分离:运营者只改 /content 下的数据文件。
import personasJson from "@/content/personas.json";
import questionsJson from "@/content/questions.json";
import type { Persona, Question } from "./types";

export const personas = personasJson as Persona[];
export const questions = questionsJson as Question[];

export function personaById(id: string): Persona | undefined {
  return personas.find((p) => p.id === id);
}
