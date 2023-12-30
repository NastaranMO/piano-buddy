/**
 * Generates a new music sequence using MusicRNN continuation.
 *
 * @param {INoteSequence} noteSequence - The input note sequence.
 * @param {Object} options - Options for the generation process.
 * @param {number} [options.stepsPerQuarter=2] - The number of steps per quarter note.
 * @param {number} [options.steps=50] - The number of steps to generate.
 * @param {number} [options.temperature=1.3] - The sampling temperature for randomness.
 * @returns {Promise<INoteSequence>} A promise that resolves to the generated music sequence.
 */
async function getSampleRnn(
  noteSequence,
  options = { stepsPerQuarter: 2, steps: 50, temperature: 1.3 }
) {
  const qns = mm.sequences.quantizeNoteSequence(
    noteSequence,
    options.stepsPerQuarter
  );
  const sample = await musicRNN.continueSequence(
    qns,
    options.steps,
    options.temperature
  );
  return mm.sequences.unquantizeSequence(sample);
}
