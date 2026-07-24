export type HiringType = "CAMPUS" | "LATERAL";
export type InterviewRound = "L1" | "L2" | "GENERAL";

export function getInterviewInfo(role: string) {
  const upper = role.toUpperCase();

  const hiringType: HiringType = upper.startsWith("LATERAL - ")
    ? "LATERAL"
    : "CAMPUS";

  let round: InterviewRound = "GENERAL";

  if (upper.includes("L1")) {
    round = "L1";
  } else if (upper.includes("L2")) {
    round = "L2";
  }

  return {
    hiringType,
    round,

    isCampus: hiringType === "CAMPUS",
    isLateral: hiringType === "LATERAL",

    isL1: round === "L1",
    isL2: round === "L2",
  };
}