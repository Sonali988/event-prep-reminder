export function parseDuration(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const minutes = Number(colonMatch[1]);
    const seconds = Number(colonMatch[2]);

    if (seconds > 59) {
      return null;
    }

    return minutes * 60 + seconds;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 3) {
    return null;
  }

  const seconds = Number(digits.slice(-2));
  const minutes = Number(digits.slice(0, -2));

  if (seconds > 59) {
    return null;
  }

  return minutes * 60 + seconds;
}

export function formatDurationInput(value) {
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length <= 2) {
    return digits;
  }

  const seconds = digits.slice(-2);
  const minutes = digits.slice(0, -2);
  return `${minutes}:${seconds}`;
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

  const formatted = formatDurationInput(trimmed);
  const parsed = parseDuration(formatted);
  if (parsed === null) {
    return formatted;
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
