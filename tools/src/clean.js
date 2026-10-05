import {
  CONCLUSION_END,
  CONCLUSION_START,
  STRIPPED_PARAGRAPH_PREFIXES,
  STRIPPED_TABLE_COLUMNS,
} from "./contract.js";

// Rules and their order are fixed by design §4.2; everything else stays byte-identical.
export function cleanSource(text) {
  const lines = text.split("\n");

  const withoutConclusions = [];
  let inside = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === CONCLUSION_START) {
      if (inside) return { error: "nested conclusion:start" };
      inside = true;
      continue;
    }
    if (t === CONCLUSION_END) {
      if (!inside) return { error: "conclusion:end without conclusion:start" };
      inside = false;
      continue;
    }
    if (!inside) withoutConclusions.push(line);
  }
  if (inside) return { error: "conclusion:start without conclusion:end" };

  const withoutStatus = [];
  for (let i = 0; i < withoutConclusions.length;) {
    const line = withoutConclusions[i];
    const startsParagraph =
      line.trim() !== "" &&
      (i === 0 || withoutConclusions[i - 1].trim() === "");
    if (
      startsParagraph &&
      STRIPPED_PARAGRAPH_PREFIXES.some((p) => line.startsWith(p))
    ) {
      while (
        i < withoutConclusions.length &&
        withoutConclusions[i].trim() !== ""
      )
        i++;
      continue;
    }
    withoutStatus.push(line);
    i++;
  }

  return { text: stripTableColumns(withoutStatus).join("\n") };
}

function isTableLine(line) {
  return line.trim().startsWith("|");
}

function headerName(cell) {
  return cell.replace(/\*/g, "").trim();
}

function stripTableColumns(lines) {
  const out = [];
  for (let i = 0; i < lines.length;) {
    if (!isTableLine(lines[i])) {
      out.push(lines[i]);
      i++;
      continue;
    }
    const start = i;
    while (i < lines.length && isTableLine(lines[i])) i++;
    const table = lines.slice(start, i);
    const header = table[0].split("|");
    const drop = new Set();
    // Leading and trailing pipes produce empty edge parts; only inner parts are cells.
    for (let c = 1; c < header.length - 1; c++) {
      if (STRIPPED_TABLE_COLUMNS.includes(headerName(header[c]))) drop.add(c);
    }
    if (drop.size === 0) {
      out.push(...table);
      continue;
    }
    for (const row of table) {
      out.push(
        row
          .split("|")
          .filter((_, idx) => !drop.has(idx))
          .join("|"),
      );
    }
  }
  return out;
}
