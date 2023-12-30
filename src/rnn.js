/**
 * Generates a sample sequence by continuing the given noteSequence using an RNN model.
 * @param {Object} noteSequence - The input noteSequence to continue.
 * @param {Object} options - Options for the RNN continuation.
 * @param {number} options.stepsPerQuarter - Quantization steps per quarter note.
 * @param {number} options.steps - Number of steps to continue.
 * @param {number} options.temperature - RNN sampling temperature.
 * @returns {Object} The continued noteSequence.
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
