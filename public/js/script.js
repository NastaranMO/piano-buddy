/*************************
 * Consts for everyone!
 ************************/
// button mappings.
const MAPPING_8 = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 };
const MAPPING_4 = { 0: 0, 1: 2, 2: 5, 3: 7 };
const BUTTONS_DEVICE = ["a", "s", "d", "f", "j", "k", "l", ";"];
const BUTTONS_MAKEY = [
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "w",
  "a",
  "s",
  "d",
];

const USER_TURN = "USER";
const AI_TURN = "AI";
let currentPlayer = USER_TURN;
let usedKeyboard = false;

const BUTTONS_MAKEY_DISPLAY = ["↑", "←", "↓", "→", "w", "a", "s", "d"];

let OCTAVES = 7;
let NUM_BUTTONS = 8;
let BUTTON_MAPPING = MAPPING_8;

const modelConfig = {
  stepsPerQuarter: 2,
  steps: 20,
  temperature: 1.3,
  print: () => {
    console.log(`stepsPerQuarter: ${modelConfig.stepsPerQuarter} | steps: ${modelConfig.steps} | temperature: ${modelConfig.temperature}`);
  }
}
let timerSeconds = 10;

let keyWhitelist;
let TEMPERATURE = 0.25;

const heldButtonToVisualData = new Map();

// Which notes the pedal is sustaining.
let sustaining = false;
let sustainingNotes = [];

// Mousedown/up events are weird because you can mouse down in one element and mouse up
// in another, so you're going to lose that original element and never mouse it up.
let mouseDownButton = null;
const pianoPlayer = new Player();
const sequence = new MusicSequence();
const genie = new mm.PianoGenie(CONSTANTS.GENIE_CHECKPOINT);
const musicRNN = new mm.MusicRNN(
  // "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn"
  "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn"
);
const painter = new FloatyNotes();
const piano = new Piano();
const timer = new Timer(timerSeconds);
const infoContainer = document.getElementById("info-container");

let isUsingMakey = false;

const clickSaveButton = async (callback) => {
  settingsBox.hidden = true;
  console.log(modelConfig);
  if (callback && typeof callback === 'function') {
    await callback();
  }
}
const openConfigBox = async (isFeedback = false) => {
  const saveButton = document.getElementById('configBoxButton');
  const feedbackButton = document.getElementById('feedbackButton');
  if (isFeedback) {
    feedbackButton.style.display = 'block';
    saveButton.style.display = 'none';
  } else {
    feedbackButton.style.display = 'none';
    saveButton.style.display = 'block';
  }
  settingsBox.hidden = false;
  disablePianoKeys();
}

initEverything();

/*************************
 * Basic UI bits
 ************************/
function initEverything() {
  genie.initialize().then(() => {
    console.log("🧞‍♀️ ready!");
    playBtn.textContent = "Play";
    playBtn.removeAttribute("disabled");
    playBtn.classList.remove("loading");
  });
  musicRNN.initialize().then(() => {
    console.log("🧞‍♀️ Music RNN Ready!");
  });

  // Start the drawing loop.
  onWindowResize();
  updateButtonText();
  window.requestAnimationFrame(() => painter.drawLoop());

  // Event listeners.
  document
    .getElementById("spqButton1")
    .addEventListener(
      "change",
      (event) => event.target.checked && updateStepsPerQuarter(1)
    );
  document
    .getElementById("spqButton2")
    .addEventListener(
      "change",
      (event) => event.target.checked && updateStepsPerQuarter(2)
    );
  document
    .getElementById("spqButton4")
    .addEventListener(
      "change",
      (event) => event.target.checked && updateStepsPerQuarter(4)
    );

  document
    .getElementById("stepsTextInput")
    .addEventListener(
      "change",
      (event) => modelConfig.steps = parseInt(event.target.value)
    );  

  document
    .getElementById("temperatureTextInput")
    .addEventListener(
      "change",
      (event) => modelConfig.temperature = parseFloat(event.target.value)
    );  
  document
    .getElementById("timerTextInput")
    .addEventListener(
      "change",
      (event) => timerSeconds = parseInt(event.target.value)
    );  
  document
    .getElementById("configBoxButton")
    .addEventListener("click", () => clickSaveButton(enablePianoKeys));  
  document
    .getElementById("feedbackButton")
    .addEventListener("click", () => clickSaveButton(aiTurn));  
  

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("orientationchange", onWindowResize);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function updateStepsPerQuarter(num) {
  modelConfig.stepsPerQuarter = num;
}

function showMainScreen() {
  document.querySelector(".splash").hidden = true;
  document.querySelector(".loaded").hidden = false;

  document.addEventListener("keydown", onKeyDown);

  controls.addEventListener("touchstart", (event) => doTouchStart(event), {
    passive: true,
  });
  controls.addEventListener("touchend", (event) => doTouchEnd(event), {
    passive: true,
  });

  const hasTouchEvents = "ontouchstart" in window;
  if (!hasTouchEvents) {
    controls.addEventListener("mousedown", (event) => doTouchStart(event));
    controls.addEventListener("mouseup", (event) => doTouchEnd(event));
  }

  controls.addEventListener("mouseover", (event) => doTouchMove(event, true));
  controls.addEventListener("mouseout", (event) => doTouchMove(event, false));
  controls.addEventListener("touchenter", (event) => doTouchMove(event, true));
  controls.addEventListener("touchleave", (event) => doTouchMove(event, false));
  canvas.addEventListener("mouseenter", () => (mouseDownButton = null));

  
  document.addEventListener("keyup", onKeyUp);

  // Slow to start up, so do a fake prediction to warm up the model.
  const note = genie.nextFromKeyWhitelist(0, keyWhitelist, TEMPERATURE);
  genie.resetState();

  idleBoxContent(true);
}

// Here touch means either touch or mouse.
function doTouchStart(event) {
  event.preventDefault();
  mouseDownButton = event.target;
  buttonDown(event.target.dataset.id, true);
}
function doTouchEnd(event) {
  event.preventDefault();
  if (mouseDownButton && mouseDownButton !== event.target) {
    buttonUp(mouseDownButton.dataset.id);
  }
  mouseDownButton = null;
  buttonUp(event.target.dataset.id);
}
function doTouchMove(event, down) {
  // If we're already holding a button down, start holding this one too.
  if (!mouseDownButton) return;

  if (down) buttonDown(event.target.dataset.id, true);
  else buttonUp(event.target.dataset.id, true);
}

/*************************
 * Button actions
 ************************/
const currentPressedKey = {
  pitch: null,
  startTime: null,
  endTime: null,
  addToSequence: (sequencer) => {
    if (!sequencer) {
      console.error("Cannot add pitch as Sequencer not provided");
    }
    if (!currentPressedKey.startTime) {
      console.error("Cannot add pitch as start time not set");
    }
    if (!currentPressedKey.endTime) {
      console.warn(
        "endTime not provided for adding pitch to sequencer. Current time will be used as endTime"
      );
      currentPressedKey.endTime = new Date().getTime();
    }
    const durationInSeconds =
      (currentPressedKey.endTime - currentPressedKey.startTime) / 1000;
    sequencer.addPitch(currentPressedKey.pitch, durationInSeconds, {tag: USER_TURN});
  },
};
const disablePianoKeys = () => {
  const btnNoteElements = document.getElementsByClassName("btn-note");
  for (var i = 0; i < btnNoteElements.length; i++) {
    var element = btnNoteElements[i];

    // Add 'btn-disabled' class
    element.classList.add("btn-disabled");

    // Add 'disabled' attribute
    element.setAttribute("disabled", true);
  }
}
const enablePianoKeys = () => {
  const btnNoteElements = document.getElementsByClassName("btn-note");
  for (var i = 0; i < btnNoteElements.length; i++) {
    var element = btnNoteElements[i];

    // Remove 'btn-disabled' class
    element.classList.remove("btn-disabled");

    // Remove 'disabled' attribute
    element.removeAttribute("disabled");
  }
}
const togglePianoKeys = () => {
  
  if (currentPlayer === USER_TURN) {
    // Enable piano keys for user turn
    enablePianoKeys();
    return;
  }
  if (currentPlayer === AI_TURN) {
    // Disable piano keys for AI turn
    disablePianoKeys();
    return;
  }
  console.error(`Current player is not recoginized: ${currentPlayer}`);
}
const switchPlayer = () => {
  console.info(`Switching Player: old player = ${currentPlayer}`);
  
  currentPlayer = currentPlayer === USER_TURN ? AI_TURN : USER_TURN;
  console.info(`Player Switched: current player = ${currentPlayer}`);
}
const updateInfoBox = () => {
  infoContainer.style.display = 'block';
  const pElement = document.createElement('p');
  pElement.className = 'info-text';
  pElement.textContent = '🎵 AI is playing... 🎵';
  infoContainer.appendChild(pElement);
  return pElement;
}

const playAll = async () => {
  const seq = sequence.getSequence(false)
  for (const n of seq.notes) {
    const duration = n.endTime - n.startTime;
    const note = n.pitch - CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE;

    try {
      const key = 8;
      pianoPlayer.playNoteDown(n.pitch)
      const rect = piano.highlightNote(note, key);
  
      if (!rect) {
        debugger;
      }
      const noteToPaint = painter.addNote(
        key,
        rect.getAttribute("x"),
        rect.getAttribute("width")
      );
      heldButtonToVisualData.set(0, {
        rect: rect,
        note: note,
        noteToPaint: noteToPaint,
      });
      await sleep(duration * 1000)  
    } catch (error) {
      console.warn(`note ${note} with pitch ${n.pitch} failed to play. Ignoring it`);
    } finally {
      buttonUp(0)
    }
  }
}
const firstTimeText = () => `You can play your part on the piano, and the AI will join in. Ready to start? 🚀<br>
<span class='hint-playing'>Pro tip: Enhance your experience by using the keyboard for faster and more creative play. Try the number keys [1-8] or the home row [a-f],[j-;].
<span>`
const nonFirstTimeText = () => {
  let text = "Ready for another round? 🎹 <br>It's your turn to play!";
  if (!usedKeyboard) {
    text += `<br/> <span class='hint-playing'>Remember to enhance your experience by using the keyboard for faster and more creative play. <br/>Experiment with the number keys [1-8] or the home row [a-f], [j-;].
    <span>`;
  }
  return text;

}

const idleBoxContent = (firstTime) => {
  infoContainer.innerHTML = '';
  infoContainer.style.display = 'block';
  const pElement = document.createElement('p');
  pElement.className = 'info-text';
  pElement.innerHTML = firstTime ? firstTimeText() : nonFirstTimeText();

  infoContainer.appendChild(pElement);

  if (!firstTime) {
    // play all is not working in this version
    return;
    // TODO: add implementation
    const playAllButton = document.createElement('button');
    playAllButton.textContent = 'Play the full melody 🎧';
    playAllButton.className = 'btn-green';
    playAllButton.disabled = true;
    playAllButton.onclick = async () => {
      disablePianoKeys();
      pElement.textContent = `Enjoy the melody co-created by you and the AI! 🤩`;
      playAllButton.disabled = true;
      await playAll();
      enablePianoKeys();
      pElement.textContent = firstTime ? firstTimeText() : nonFirstTimeText();
      playAllButton.disabled = false;
    }
    infoContainer.appendChild(playAllButton);
  }
}

const addActionBox = async () => {
  infoContainer.style.display = 'block';
  const pElement = document.createElement('p');
  pElement.className = 'info-text';
  // pElement.textContent = `It's your turn! 🎹 `;
  pElement.innerHTML = `
  Did you enjoy it? 🤔<br/>
<span class='hint-playing'>If not, you can fine-tune your experience! Clicking 'No' opens a dialog where you can customize model configurations and generate another piece of melody.
</span>
  `

  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Yes';
  confirmButton.className = 'btn-green';
  confirmButton.onclick = () => {
    sequence.clear();
    switchPlayer();
    togglePianoKeys();
    idleBoxContent(false);
  }

  const declineButton = document.createElement('button');
  declineButton.textContent = 'No';
  declineButton.className = 'btn-red';
  declineButton.onclick = async () => {
    infoContainer.innerHTML = '';
    openConfigBox(true);
  }

  infoContainer.appendChild(pElement);
  infoContainer.appendChild(confirmButton);
  infoContainer.appendChild(declineButton);

  return pElement;
}
const showAlertBox = () => {
  infoContainer.innerHTML = '';
  infoContainer.style.display = 'block';

  const pElement = document.createElement('p');
  pElement.className = 'info-text';
  pElement.innerHTML = `😱 Oops! It seems the AI didn't generate any music.<br>
  <span class='hint-playing'>You can inspire the AI by playing longer sequences or adjusting the model configurations.</span>`;

  const changeConfigButton = document.createElement('button');
  changeConfigButton.textContent = 'Change Configs';
  changeConfigButton.className = 'btn-green';
  changeConfigButton.onclick = async () => {
    infoContainer.innerHTML = '';
    openConfigBox(true);
  }

  const playButton = document.createElement('button');
  playButton.textContent = 'Play Again';
  playButton.className = 'btn-blue';
  playButton.onclick = async () => {
    sequence.clear();
    switchPlayer();
    togglePianoKeys();
    idleBoxContent(false);
  }
  infoContainer.appendChild(pElement);
  infoContainer.appendChild(changeConfigButton);
  infoContainer.appendChild(playButton);
}
const aiTurn = async () => {
  if (currentPlayer !== AI_TURN) {
    switchPlayer();
    togglePianoKeys();
  }
  const elem = updateInfoBox();

  const modelInput = sequence.getSequencesByTag(USER_TURN);
  console.info(`sampling from model with input: ${modelInput.notes.length} notes, duration ${modelInput.totalTime}s`);
  modelConfig.print();

  const sample = await getSampleRnn(modelInput, modelConfig);
  if (!sample || sample.notes.length === 0) {
    showAlertBox();
    return;
  }
  
  for (const n of sample.notes) {
    const duration = n.endTime - n.startTime;
    const note = n.pitch - CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE;

    try {
      const key = 8;
      pianoPlayer.playNoteDown(n.pitch)
      const rect = piano.highlightNote(note, key);
  
      if (!rect) {
        debugger;
      }
      const noteToPaint = painter.addNote(
        key,
        rect.getAttribute("x"),
        rect.getAttribute("width")
      );
      heldButtonToVisualData.set(0, {
        rect: rect,
        note: note,
        noteToPaint: noteToPaint,
      });
      await sleep(duration * 1000)  
    } catch (error) {
      console.warn(`note ${note} with pitch ${n.pitch} failed to play. Ignoring it`);
    } finally {
      buttonUp(0)
    }
    
    sequence.addPitch(n.pitch, n.endTime - n.startTime, {tag: AI_TURN});
  }
  
  infoContainer.removeChild(elem);
  addActionBox();
};
const buttonDown = async (button, fromKeyDown, setTimer) => {
  // If we're already holding this button down, nothing new to do.
  if (heldButtonToVisualData.has(button)) {
    return;
  }

  const el = document.getElementById(`btn${button}`);
  if (!el) {
    console.warn(`Trying to press ${button} but the element not found`);
    return;
  }
  if (el.getAttribute("disabled") === "true") {
    // button is already disabled
    return;
  }
  el.setAttribute("active", true);

  const note = genie.nextFromKeyWhitelist(
    BUTTON_MAPPING[button],
    keyWhitelist,
    TEMPERATURE
  );
  const pitch = CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + note;
  currentPressedKey.pitch = pitch;
  currentPressedKey.startTime = new Date().getTime();
  try {
    pianoPlayer.playNoteDown(pitch, button);
  } catch (error) {
    console.warn(`note ${note} with pitch ${pitch} failed to play. Ignoring it`);
  }
  timer.start(async () => {
    await aiTurn();
  });
  // See it.
  const rect = piano.highlightNote(note, button);

  if (!rect) {
    debugger;
  }
  // Float it.
  const noteToPaint = painter.addNote(
    button,
    rect.getAttribute("x"),
    rect.getAttribute("width")
  );
  heldButtonToVisualData.set(button, {
    rect: rect,
    note: note,
    noteToPaint: noteToPaint,
  });
};

function buttonUp(button) {
  const el = document.getElementById(`btn${button}`);
  if (!el) return;
  el.removeAttribute("active");

  const thing = heldButtonToVisualData.get(button);
  if (thing) {
    // Don't see it.
    piano.clearNote(thing.rect);

    // Stop holding it down.
    painter.stopNote(thing.noteToPaint);

    // Maybe stop hearing it.
    const pitch = CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + thing.note;
    if (!sustaining) {
      if (currentPlayer === USER_TURN) {
        currentPressedKey.endTime = new Date().getTime();
        currentPressedKey.addToSequence(sequence);
      }
      pianoPlayer.playNoteUp(pitch, button);
    } else {
      sustainingNotes.push(CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + thing.note);
    }
  }
  heldButtonToVisualData.delete(button);
}

/*************************
 * Events
 ************************/
const onKeyDown = (event) => {
  // Keydown fires continuously and we don't want that.
  if (event.repeat) {
    return;
  }
  if (event.key === " ") {
    // sustain pedal
    sustaining = true;
  } else if (event.key === "r") {
    console.log("🧞‍♀️ resetting!");
    genie.resetState();
  } else {
    const button = getButtonFromKeyCode(event.key);
    if (button != null) {
      usedKeyboard = true;
      buttonDown(button, true);
    }
  }
};

function onKeyUp(event) {
  if (event.key === " ") {
    // sustain pedal
    sustaining = false;

    // Release everything.
    sustainingNotes.forEach((note) => pianoPlayer.playNoteUp(note, -1));
    sustainingNotes = [];
  } else {
    const button = getButtonFromKeyCode(event.key);
    if (button != null) {
      usedKeyboard = true;
      buttonUp(button);
    }
  }
}

function onWindowResize() {
  OCTAVES = window.innerWidth > 700 ? 7 : 3;
  const bonusNotes = OCTAVES > 6 ? 4 : 0; // starts on an A, ends on a C.
  const totalNotes = CONSTANTS.NOTES_PER_OCTAVE * OCTAVES + bonusNotes;
  const totalWhiteNotes =
    CONSTANTS.WHITE_NOTES_PER_OCTAVE * OCTAVES + (bonusNotes - 1);
  keyWhitelist = Array(totalNotes)
    .fill()
    .map((x, i) => {
      if (OCTAVES > 6) return i;
      // Starting 3 semitones up on small screens (on a C), and a whole octave up.
      return i + 3 + CONSTANTS.NOTES_PER_OCTAVE;
    });

  piano.resize(totalWhiteNotes);
  painter.resize(piano.config.whiteNoteHeight);
  piano.draw();
}

/*************************
 * Utils and helpers
 ************************/
function getButtonFromKeyCode(key) {
  // 1 - 8
  if (key >= "1" && key <= String(NUM_BUTTONS)) {
    return parseInt(key) - 1;
  }

  const index = isUsingMakey
    ? BUTTONS_MAKEY.indexOf(key)
    : BUTTONS_DEVICE.indexOf(key);
  return index !== -1 ? index : null;
}

function parseHashParameters() {
  const hash = window.location.hash.substring(1);
  const params = {};
  hash.split("&").map((hk) => {
    let temp = hk.split("=");
    params[temp[0]] = temp[1];
  });
  return params;
}

function updateButtonText() {
  const btns = document.querySelectorAll(".controls button.color");
  for (let i = 0; i < btns.length; i++) {
    btns[i].innerHTML = isUsingMakey
      ? `<span>${BUTTONS_MAKEY_DISPLAY[i]}</span>`
      : `<span>${i + 1}</span><br><span>${BUTTONS_DEVICE[i]}</span>`;
  }
}
