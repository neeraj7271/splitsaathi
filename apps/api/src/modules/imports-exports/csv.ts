export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }
    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== '')) {
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: Array<Array<string | number | undefined>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell === undefined ? '' : String(cell);
          return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
        })
        .join(',')
    )
    .join('\n');
}

export function decimalToMinor(value: string): number {
  const trimmed = value.trim().replace(/[₹,\s]/g, '');
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 100;
  }
  const match = trimmed.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new Error(`Invalid decimal money amount: ${value}`);
  }
  const sign = match[1] === '-' ? -1 : 1;
  const major = Number.parseInt(match[2], 10);
  const minor = Number.parseInt((match[3] ?? '').padEnd(2, '0'), 10);
  return sign * (major * 100 + minor);
}
