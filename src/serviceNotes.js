export function getDefaultServiceNotes() {
  return {
    remarks: "",
    observations: "",
    challenges: "",
  };
}

export function mergeServiceNotes(saved) {
  const defaults = getDefaultServiceNotes();

  if (!saved) {
    return defaults;
  }

  return {
    remarks: typeof saved.remarks === "string" ? saved.remarks : "",
    observations: typeof saved.observations === "string" ? saved.observations : "",
    challenges: typeof saved.challenges === "string" ? saved.challenges : "",
  };
}

export function buildServiceNotesSummary(notes) {
  const filled = [
    notes.remarks.trim() ? "remarks" : null,
    notes.observations.trim() ? "observations" : null,
    notes.challenges.trim() ? "challenges" : null,
  ].filter(Boolean);

  if (filled.length === 0) {
    return "No notes recorded yet";
  }

  return `${filled.length} section${filled.length > 1 ? "s" : ""} filled — ${filled.join(", ")}`;
}

export function buildServiceNotesMessage(notes) {
  const sections = [
    { title: "Remarks", content: notes.remarks },
    { title: "Observations", content: notes.observations },
    { title: "Challenges", content: notes.challenges },
  ];

  const lines = ["Service notes:"];
  let hasContent = false;

  for (const section of sections) {
    const content = section.content.trim();
    if (!content) {
      continue;
    }

    hasContent = true;
    lines.push("");
    lines.push(`${section.title}:`);
    lines.push(content);
  }

  if (!hasContent) {
    return "";
  }

  return lines.join("\n");
}

export function hasServiceNotes(notes) {
  return Boolean(
    notes.remarks.trim() || notes.observations.trim() || notes.challenges.trim(),
  );
}
