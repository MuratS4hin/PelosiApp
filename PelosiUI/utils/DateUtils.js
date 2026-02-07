export function parseCongressDate(dateStr) {
  if (!dateStr) return null;

  // Remove commas → "Nov. 10 2025"
  const cleaned = dateStr.replace(',', '');
  const parts = cleaned.split(' ');

  if (parts.length < 3) return null;

  const [monthStr, day, year] = parts;

  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const month = monthMap[monthStr.replace('.', '')];
  return new Date(year, month, day);
}
