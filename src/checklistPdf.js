import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getGroupProgress } from "./state.js";

const IST_TIME_ZONE = "Asia/Kolkata";

export function formatIstDateTime(value, { withSeconds = true } = {}) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return `${date.toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: true,
  })} IST`;
}

function formatCheckedAt(item) {
  if (!item.checked) {
    return "—";
  }

  if (!item.checkedAt) {
    return "Checked (time not recorded)";
  }

  return formatIstDateTime(item.checkedAt);
}

function buildFileName(now = new Date()) {
  const datePart = now
    .toLocaleDateString("en-CA", { timeZone: IST_TIME_ZONE })
    .replaceAll("/", "-");
  return `service-prep-checklist-${datePart}.pdf`;
}

export function exportChecklistPdf(state, now = new Date()) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let totalItems = 0;
  let completedItems = 0;

  for (const group of state.groups) {
    const progress = getGroupProgress(group);
    totalItems += progress.total;
    completedItems += progress.done;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Event Prep Checklist", margin, 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${formatIstDateTime(now)}`, margin, 76);
  doc.text(`Service end time: ${state.endTime}`, margin, 90);
  doc.text(`Progress: ${completedItems} / ${totalItems} completed`, margin, 104);
  doc.setTextColor(0, 0, 0);

  let startY = 124;

  for (const group of state.groups) {
    const { done, total } = getGroupProgress(group);

    if (startY > 700) {
      doc.addPage();
      startY = 56;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${group.title} (${done}/${total})`, margin, startY);
    startY += 10;

    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      head: [["#", "Item", "Status", "Checked at (IST)"]],
      body: group.items.map((item, index) => [
        String(index + 1),
        item.label,
        item.checked ? "Done" : "Pending",
        formatCheckedAt(item),
      ]),
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 6,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [33, 41, 53],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 230 },
        2: { cellWidth: 58 },
        3: { cellWidth: 150 },
      },
      theme: "grid",
    });

    startY = doc.lastAutoTable.finalY + 22;
  }

  doc.save(buildFileName(now));
}
