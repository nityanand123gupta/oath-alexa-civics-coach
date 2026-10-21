import type { CivicsQuestion } from "@oath/civics-kit";

/**
 * Deterministic, template-based explanations. The exam itself is in English,
 * so official answers always stay in English; the surrounding guidance can be
 * localized. No model in the loop — reproducible and testable.
 */

type Lang = "en" | "es" | "hi";

const TEMPLATES: Record<Lang, {
  official: string;        // {answers}
  anyOf: string;           // when several answers are acceptable
  needCount: string;       // {n}
  dynamic: string;         // {note}
  category: string;        // {category} / {subcategory}
  senior: string;
}> = {
  en: {
    official: "The official acceptable answer is: {answers}.",
    anyOf: "Any one of these official answers is accepted: {answers}.",
    needCount: "This question asks you to give {n} answers — any {n} from the official list count.",
    dynamic: "Heads up: this answer can change. {note}",
    category: "It belongs to the \"{category}\" section ({subcategory}).",
    senior: "This is one of the designated questions for applicants 65 or older with 20+ years as a permanent resident.",
  },
  es: {
    official: "La respuesta oficial aceptada es: {answers}.",
    anyOf: "Cualquiera de estas respuestas oficiales es aceptada: {answers}.",
    needCount: "Esta pregunta pide {n} respuestas — cualesquiera {n} de la lista oficial cuentan.",
    dynamic: "Atención: esta respuesta puede cambiar. {note}",
    category: "Pertenece a la sección \"{category}\" ({subcategory}).",
    senior: "Esta es una de las preguntas designadas para solicitantes de 65 años o más con 20+ años como residente permanente.",
  },
  hi: {
    official: "आधिकारिक स्वीकृत उत्तर है: {answers}.",
    anyOf: "इनमें से कोई भी आधिकारिक उत्तर स्वीकार किया जाता है: {answers}.",
    needCount: "इस प्रश्न में {n} उत्तर देने होते हैं — आधिकारिक सूची में से कोई भी {n} मान्य हैं।",
    dynamic: "ध्यान दें: यह उत्तर बदल सकता है। {note}",
    category: "यह \"{category}\" खंड ({subcategory}) से है।",
    senior: "यह प्रश्न उन आवेदकों के लिए निर्दिष्ट है जो 65+ वर्ष के हैं और 20+ वर्षों से स्थायी निवासी हैं।",
  },
};

export const SUPPORTED_LANGUAGES = ["en", "es", "hi"] as const;

export function explainQuestion(q: CivicsQuestion, language: string, requiredCount: number): string {
  const lang: Lang = (SUPPORTED_LANGUAGES as readonly string[]).includes(language) ? (language as Lang) : "en";
  const t = TEMPLATES[lang];
  const parts: string[] = [];

  const answers = q.acceptableAnswers.join("; ");
  if (q.acceptableAnswers.length > 1 && requiredCount === 1) {
    parts.push(t.anyOf.replace("{answers}", answers));
  } else {
    parts.push(t.official.replace("{answers}", answers));
  }
  if (requiredCount > 1) {
    parts.push(t.needCount.replaceAll("{n}", String(requiredCount)));
  }
  if (q.dynamic) {
    parts.push(
      t.dynamic.replace(
        "{note}",
        q.dynamicNote ?? "Check uscis.gov/citizenship/testupdates before your interview."
      )
    );
  }
  parts.push(t.category.replace("{category}", q.category).replace("{subcategory}", q.subcategory));
  if (q.senior) parts.push(t.senior);
  return parts.join(" ");
}
