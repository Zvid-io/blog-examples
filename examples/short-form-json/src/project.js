// These limits belong to this compact teaching example, not to Zvid's schema.
function shortText(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[<>\r\n]/.test(value))
    throw new Error(`${label} must be one line of 1-${maximum} characters without angle brackets.`);
  return value.trim();
}

export function buildProject(content) {
  if (!content || !Array.isArray(content.beats) || content.beats.length !== 3)
    throw new Error('This example requires exactly three beats.');
  const series = shortText(content.series, 'series', 24);
  const seconds = content.secondsPerScene;
  if (!Number.isFinite(seconds) || seconds < 3 || seconds > 8)
    throw new Error('secondsPerScene must be between 3 and 8 for this example.');
  const text = (value, x, y, width, height, size, color, extra = {}) => ({
    type: 'TEXT', text: value, x, y, width, height, anchor: 'top-left', fitToBox: true,
    style: { fontFamily: 'Inter', fontSize: `${size}px`, fontWeight: 800, color, lineHeight: 1.08, ...extra },
  });
  return {
    name: 'short-form-json', width: 1080, height: 1920, frameRate: 30,
    outputFormat: 'mp4', backgroundColor: '#24142F',
    scenes: content.beats.map((beat, i) => ({
      id: `beat-${i + 1}`, duration: seconds,
      visuals: [
        text(series, 120, 380, 780, 70, 32, '#F6EFE2', { letterSpacing: '5px' }),
        text(String(i + 1).padStart(2, '0'), 120, 520, 200, 150, 100, '#FF805E'),
        text(shortText(beat.title, `beats[${i}].title`, 40), 120, 720, 780, 430, 128, '#F6EFE2', { textTransform: 'uppercase' }),
        text(shortText(beat.detail, `beats[${i}].detail`, 64), 120, 1220, 780, 160, 42, '#D0C4D6', { fontWeight: 500, lineHeight: 1.35 }),
        text(`${i + 1} / 3`, 120, 1460, 780, 60, 28, '#FF805E', { fontWeight: 600 }),
      ],
    })),
  };
}
