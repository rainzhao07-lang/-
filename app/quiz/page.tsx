import type { Metadata } from "next";
import QuizFlow from "@/components/QuizFlow";

export const metadata: Metadata = { title: "答题中" };

export default function QuizPage() {
  return <QuizFlow />;
}
