export function parseDuration(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);

  if (seconds > 59) {
    return null;
  }

  return minutes * 60 + seconds;
}

export function formatDurationSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeDuration(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const parsed = parseDuration(trimmed);
  if (parsed === null) {
    return trimmed;
  }

  return formatDurationSeconds(parsed);
}

export function sumMainTestimonySeconds(mainTestimonies) {
  return mainTestimonies.reduce((total, testimony) => {
    const seconds = parseDuration(testimony.duration);
    if (seconds === null || !testimony.name.trim()) {
      return total;
    }

    return total + seconds;
  }, 0);
}

export function buildBackstageMessage(timers) {
  const lines = ["Testimonies timer: "];
  let index = 1;

  for (const testimony of timers.main) {
    const name = testimony.name.trim();
    const seconds = parseDuration(testimony.duration);
    if (!name || seconds === null) {
      continue;
    }

    lines.push(`${index}. ${name} ${formatDurationSeconds(seconds)}`);
    index += 1;
  }

  for (const backup of timers.backup) {
    const name = backup.name.trim();
    if (!name) {
      continue;
    }

    lines.push(`backup ${name}`);
  }

  const totalSeconds = sumMainTestimonySeconds(timers.main);
  const introSeconds = parseDuration(timers.introTimer);

  lines.push("");

  if (introSeconds !== null && timers.introTimer.trim()) {
    lines.push(`*Intro timer: ${formatDurationSeconds(introSeconds)}*`);
    lines.push("");
  }

  lines.push(`*total testimonies timer: ${formatDurationSeconds(totalSeconds)}*`);

  return lines.join("\n");
}
