/*************************
 * Consts for everyone!
 ************************/
// button mappings.
// MAPPING_8 maps piano keys 0-7 to button indices 0-7
// MAPPING_4 maps piano keys 0, 2, 5, 7 to button indices 0-3
// BUTTONS_DEVICE lists keyboard buttons used when not using Makey Makey
// BUTTONS_MAKEY lists arrow keys and WASD used when using Makey Makey
// USER_TURN and AI_TURN track whether user or AI is currently playing
// currentPlayer keeps track of current player turn
// BUTTONS_MAKEY_DISPLAY maps Makey Makey inputs to display arrows and letters
// OCTAVES sets number of octaves on piano
// NUM_BUTTONS sets number of input buttons
// BUTTON_MAPPING selects which input mapping to use
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

/**
 * Configuration object for the generative music model.
 * Contains parameters for controlling the generated music:
 * - stepsPerQuarter: Steps per quarter note. Higher = slower tempo.
 * - steps: Number of steps to generate.
 * - temperature: Randomness factor. Higher = more random.
 * - print: Debugging function to print current config.
 */
const modelConfig = {
  stepsPerQuarter: 2,
  steps: 20,
  temperature: 1.3,
  print: () => {
    console.log(
      `stepsPerQuarter: ${modelConfig.stepsPerQuarter} | steps: ${modelConfig.steps} | temperature: ${modelConfig.temperature}`
    );
  },
};
/**
 * Global variables related to the piano player, generative models,
 * and UI elements.
 *
 * timerSeconds: Length of timer in seconds.
 * keyWhitelist: Whitelist of allowed piano keys.
 * TEMPERATURE: Temperature parameter for generative model.
 * heldButtonToVisualData: Map to track held buttons.
 * sustaining: Flag for pedal sustain.
 * sustainingNotes: Notes being sustained by pedal.
 * mouseDownButton: Tracks mousedown for piano buttons.
 * pianoPlayer: Player instance that plays notes.
 * sequence: MusicSequence instance to represent notes.
 * genie: PianoGenie instance for generative model.
 * musicRNN: MusicRNN instance for generative model.
 * painter: FloatyNotes instance to draw piano notes.
 * piano: Piano instance representing piano interface.
 * timer: Timer instance to track length of music.
 * infoContainer: UI container element.
 * isUsingMakey: Flag for when Makey Makey is connected.
 */
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

/**
 * Hides the settings box UI element, logs the modelConfig,
 * and executes the provided callback function if it is a function.
 *
 * @param {Function} callback - Optional callback function to execute after hiding settings box.
 */
const clickSaveButton = async (callback) => {
  settingsBox.hidden = true;
  console.log(modelConfig);
  if (callback && typeof callback === "function") {
    await callback();
  }
};
/**
 * Opens the configuration box UI element.
 * @param {boolean} isFeedback - Whether to show feedback button instead of save button.
 */
const openConfigBox = async (isFeedback = false) => {
  const saveButton = document.getElementById("configBoxButton");
  const feedbackButton = document.getElementById("feedbackButton");
  if (isFeedback) {
    feedbackButton.style.display = "block";
    saveButton.style.display = "none";
  } else {
    feedbackButton.style.display = "none";
    saveButton.style.display = "block";
  }
  settingsBox.hidden = false;
  disablePianoKeys();
};

/**
 * Initializes all modules and sets up event listeners.
 * This function handles initializing the models, starting
 * the drawing loop, and attaching event listeners.
 */
initEverything();

/*************************
 * Basic UI bits
 ************************/
/**
 * Initializes all modules and sets up event listeners.
 * This function handles initializing the models, starting
 * the drawing loop, and attaching event listeners.
 */
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
      (event) => (modelConfig.steps = parseInt(event.target.value))
    );

  document
    .getElementById("temperatureTextInput")
    .addEventListener(
      "change",
      (event) => (modelConfig.temperature = parseFloat(event.target.value))
    );
  document
    .getElementById("timerTextInput")
    .addEventListener("change", (event) => {
      timerSeconds = parseInt(event.target.value);
      timer.setTimer(timerSeconds);
    });
  document
    .getElementById("configBoxButton")
    .addEventListener("click", () => clickSaveButton(enablePianoKeys));
  document
    .getElementById("feedbackButton")
    .addEventListener("click", () => clickSaveButton(aiTurn));

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("orientationchange", onWindowResize);
}

/**
 * Pauses execution for the given number of milliseconds.
 * @param {number} ms - Number of milliseconds to pause for.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Updates the stepsPerQuarter configuration value for the model.
 * @param {number} num - The new number of steps per quarter note.
 */
function updateStepsPerQuarter(num) {
  modelConfig.stepsPerQuarter = num;
}

/**
 * Shows the main screen by:
 * - Hiding the splash screen
 * - Showing the loaded screen
 * - Adding keyboard and touch event listeners
 * - Doing a fake model prediction to warm up
 * - Showing the idle box content
 */
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
/**
 * Handles a touch start event by setting the mouseDownButton
 * to the target element, preventing default event behavior,
 * and triggering a button down event for the target button ID.
 */
function doTouchStart(event) {
  event.preventDefault();
  mouseDownButton = event.target;
  buttonDown(event.target.dataset.id, true);
}
/**
 * Handles a touch end event by preventing default behavior,
 * releasing any held down buttons, setting mouseDownButton
 * to null, and triggering a button up event for the target
 * button ID.
 */
function doTouchEnd(event) {
  event.preventDefault();
  if (mouseDownButton && mouseDownButton !== event.target) {
    buttonUp(mouseDownButton.dataset.id);
  }
  mouseDownButton = null;
  buttonUp(event.target.dataset.id);
}
/**
 * Handles touch move events by checking if a button is already held down.
 * If so, starts holding down or releases the target button based on the
 * down parameter. Prevents default event behavior.
 *
 * @param {Event} event - The touch move event
 * @param {boolean} down - Whether this is a touch down or touch up event
 */
function doTouchMove(event, down) {
  // If we're already holding a button down, start holding this one too.
  if (!mouseDownButton) return;

  if (down) buttonDown(event.target.dataset.id, true);
  else buttonUp(event.target.dataset.id, true);
}

/*************************
 * Button actions
 ************************/
/**
 * Object representing the currently pressed piano key.
 * Stores pitch, start time, end time and a method to
 * add the key press to a sequencer.
 *
 * @type {Object}
 */
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
    sequencer.addPitch(currentPressedKey.pitch, durationInSeconds, {
      tag: USER_TURN,
    });
  },
};
/**
 * Disables all piano key buttons by adding the 'btn-disabled' class and
 * 'disabled' attribute to each button element. Loops through all elements
 * with 'btn-note' class and disables them. Used to prevent piano input
 * during opponent's turn.
 */
const disablePianoKeys = () => {
  const btnNoteElements = document.getElementsByClassName("btn-note");
  for (var i = 0; i < btnNoteElements.length; i++) {
    var element = btnNoteElements[i];

    // Add 'btn-disabled' class
    element.classList.add("btn-disabled");

    // Add 'disabled' attribute
    element.setAttribute("disabled", true);
  }
};
/**
 * Enables all piano key buttons by removing the 'btn-disabled' class and
 * 'disabled' attribute from each button element.
 * Loops through all elements with 'btn-note' class and enables them.
 * Used to allow piano input during user's turn.
 */
const enablePianoKeys = () => {
  const btnNoteElements = document.getElementsByClassName("btn-note");
  for (var i = 0; i < btnNoteElements.length; i++) {
    var element = btnNoteElements[i];

    // Remove 'btn-disabled' class
    element.classList.remove("btn-disabled");

    // Remove 'disabled' attribute
    element.removeAttribute("disabled");
  }
};
/**
 * Toggles the piano keys on and off based on whose turn it is.
 * If it is the user's turn, it enables the piano keys.
 * If it is the AI's turn, it disables the piano keys.
 * Prints error if currentPlayer is not recognized.
 */
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
};
/**
 * Switches the current player between the user and AI.
 * Logs the old and new current player to the console.
 */
const switchPlayer = () => {
  console.info(`Switching Player: old player = ${currentPlayer}`);

  currentPlayer = currentPlayer === USER_TURN ? AI_TURN : USER_TURN;
  console.info(`Player Switched: current player = ${currentPlayer}`);
};
/**
 * Updates the info box UI element to show a message that the AI is currently playing.
 * Displays the info box, creates a new p element with text indicating the AI is playing,
 * adds the p element to the info box container, and returns the new p element.
 */
const updateInfoBox = () => {
  infoContainer.style.display = "block";
  const pElement = document.createElement("p");
  pElement.className = "info-text";
  pElement.textContent = "🎵 AI is playing... 🎵";
  infoContainer.appendChild(pElement);
  return pElement;
};

/**
 * Plays the full sequence of notes that were recorded from the user and AI.
 * Loops through each note, plays it using the pianoPlayer, highlights the piano key,
 * adds a painted note to the painter, and waits the note's duration before playing
 * the next note. Catches any errors playing notes and logs a warning.
 */
const playAll = async () => {
  const seq = sequence.getSequence(false);
  for (const n of seq.notes) {
    const duration = n.endTime - n.startTime;
    const note = n.pitch - CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE;

    try {
      const key = 8;
      pianoPlayer.playNoteDown(n.pitch);
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
      await sleep(duration * 1000);
    } catch (error) {
      console.warn(
        `note ${note} with pitch ${n.pitch} failed to play. Ignoring it`
      );
    } finally {
      buttonUp(0);
    }
  }
};
/**
 * Returns the text content to display in the info box the first time the user
 * interacts with the piano. Contains instructions for the user on how to
 * play notes and use the keyboard.
 */
const firstTimeText =
  () => `You can play your part on the piano, and the AI will join in. Ready to start? 🚀<br>
<span class='hint-playing'>Pro tip: Enhance your experience by using the keyboard for faster and more creative play. Try the number keys [1-8] or the home row [a-f],[j-;].
<span>`
/**
 * Returns the text content to display in the info box when it's not the user's first time interacting with the piano.
 * Contains text prompting the user that it's their turn to play, and a hint to use the keyboard if they haven't already.
 */
const nonFirstTimeText = () => {
  let text = "Ready for another round? 🎹 <br>It's your turn to play!";
  if (!usedKeyboard) {
    text += `<br/> <span class='hint-playing'>Remember to enhance your experience by using the keyboard for faster and more creative play. <br/>Experiment with the number keys [1-8] or the home row [a-f], [j-;].
    <span>`;
  }
  return text;
};

/**
 * Sets the content of the info box based on whether it is the user's
 * first time interacting with the piano.
 * @param {boolean} firstTime - Whether this is the first time the user
 * has interacted with the piano.
 */
const idleBoxContent = (firstTime) => {
  infoContainer.innerHTML = "";
  infoContainer.style.display = "block";
  const pElement = document.createElement("p");
  pElement.className = "info-text";
  pElement.innerHTML = firstTime ? firstTimeText() : nonFirstTimeText();

  infoContainer.appendChild(pElement);

  if (!firstTime) {
    // play all is not working in this version
    return;
    // TODO: add implementation
    const playAllButton = document.createElement("button");
    playAllButton.textContent = "Play the full melody 🎧";
    playAllButton.className = "btn-green";
    playAllButton.disabled = true;
    playAllButton.onclick = async () => {
      disablePianoKeys();
      pElement.textContent = `Enjoy the melody co-created by you and the AI! 🤩`;
      playAllButton.disabled = true;
      await playAll();
      enablePianoKeys();
      pElement.textContent = firstTime ? firstTimeText() : nonFirstTimeText();
      playAllButton.disabled = false;
    };
    infoContainer.appendChild(playAllButton);
  }
};

/**
 * Adds an action box to the info container prompting the user if they enjoyed the AI-generated music.
 * Provides yes/no buttons to either clear the sequence and continue playing, or open the config box to customize the model.
 * @returns {HTMLElement} The created p element containing the text content
 */
const addActionBox = async () => {
  infoContainer.style.display = "block";
  const pElement = document.createElement("p");
  pElement.className = "info-text";
  // pElement.textContent = `It's your turn! 🎹 `;
  pElement.innerHTML = `
  Did you enjoy it? 🤔<br/>
<span class='hint-playing'>If not, you can fine-tune your experience! Clicking 'No' opens a dialog where you can customize model configurations and generate another piece of melody.
</span>
  `;

  /**
   * Creates a "Yes" confirmation button to clear the sequence and continue playing
   * when the user indicates they enjoyed the AI-generated music.
   * Clears the sequence, switches the player, toggles the piano keys,
   * and shows the idle box content.
   */
  const confirmButton = document.createElement("button");
  confirmButton.textContent = "Yes";
  confirmButton.className = "btn-green";
  confirmButton.onclick = () => {
    sequence.clear();
    switchPlayer();
    togglePianoKeys();
    idleBoxContent(false);
  };

  /**
   * Creates a "No" button allowing the user to open the configuration box
   * and customize the model if they did not enjoy the generated music.
   * Clears the info container and opens the config box.
   */
  const declineButton = document.createElement("button");
  declineButton.textContent = "No";
  declineButton.className = "btn-red";
  declineButton.onclick = async () => {
    infoContainer.innerHTML = "";
    openConfigBox(true);
  };

  infoContainer.appendChild(pElement);
  infoContainer.appendChild(confirmButton);
  infoContainer.appendChild(declineButton);

  return pElement;
};
/**
 * Shows an alert box in the info container when the AI fails to generate any music.
 * Clears existing content in the info container, displays it, and adds text indicating the failure.
 * Provides buttons to open the config box to adjust models, or clear the sequence and try playing again.
 */
const showAlertBox = () => {
  infoContainer.innerHTML = "";
  infoContainer.style.display = "block";

  const pElement = document.createElement("p");
  pElement.className = "info-text";
  pElement.innerHTML = `😱 Oops! It seems the AI didn't generate any music.<br>
  <span class='hint-playing'>You can inspire the AI by playing longer sequences or adjusting the model configurations.</span>`;

  /**
   * Creates a "Change Configs" button allowing the user
   * to open the configuration box and customize the model
   * if they did not enjoy the generated music.
   * Clears the info container and opens the config box.
   */
  const changeConfigButton = document.createElement("button");
  changeConfigButton.textContent = "Change Configs";
  changeConfigButton.className = "btn-green";
  changeConfigButton.onclick = async () => {
    infoContainer.innerHTML = "";
    openConfigBox(true);
  };

  /**
   * Creates a "Play Again" button that when clicked:
   * - Clears the current sequence
   * - Switches the current player
   * - Toggles the piano keys
   * - Hides the idle box content
   * This allows the user to easily restart the game after an error
   * or when they want to try a new sequence.
   */
  const playButton = document.createElement("button");
  playButton.textContent = "Play Again";
  playButton.className = "btn-blue";
  playButton.onclick = async () => {
    sequence.clear();
    switchPlayer();
    togglePianoKeys();
    idleBoxContent(false);
  };
  /**
   * Appends the pElement, changeConfigButton and playButton to the infoContainer DOM element.
   * This displays the alert message, change configs button, and play again button in the info box
   * after a failed music generation.
   */
  infoContainer.appendChild(pElement);
  infoContainer.appendChild(changeConfigButton);
  infoContainer.appendChild(playButton);
};
/**
 * aiTurn is an async function that handles the AI's turn in the game.
 *
 * It checks if it's the AI's turn, switches the player and toggles the piano keys if needed.
 * Gets the user's input sequence from the Sequence tracker.
 * Samples a continuation sequence from the RNN model using the user input.
 * Plays each note from the sampled sequence on the piano by highlighting the keys and calling the piano player.
 * Adds the generated notes to the sequence tracker tagged as AI_TURN.
 * Displays the action box after the AI turn is complete.
 */
const aiTurn = async () => {
  if (currentPlayer !== AI_TURN) {
    switchPlayer();
    togglePianoKeys();
  }
  const elem = updateInfoBox();

  /**
   * Gets the user input sequence from the Sequence tracker.
   * Prints debug information about the input sequence.
   * Samples a continuation sequence from the RNN model using the user input and model config.
   * Checks if a valid sample was returned, otherwise displays an alert.
   */
  const modelInput = sequence.getSequencesByTag(USER_TURN);
  console.info(
    `sampling from model with input: ${modelInput.notes.length} notes, duration ${modelInput.totalTime}s`
  );
  modelConfig.print();

  const sample = await getSampleRnn(modelInput, modelConfig);
  if (!sample || sample.notes.length === 0) {
    showAlertBox();
    return;
  }

  /**
   * Loops through each note in the sampled sequence.
   * Plays each note by:
   * - Calculating note duration
   * - Mapping pitch to piano key
   * - Playing note down
   * - Highlighting piano key
   * - Adding visual note
   * - Waiting note duration
   * - Releasing piano key
   *
   * Catches any errors playing notes and logs warning.
   *
   * Finally, adds played note to sequence tracker tagged with AI turn.
   */ for (const n of sample.notes) {
    const duration = n.endTime - n.startTime;
    const note = n.pitch - CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE;

    try {
      const key = 8;
      pianoPlayer.playNoteDown(n.pitch);
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
      await sleep(duration * 1000);
    } catch (error) {
      console.warn(
        `note ${note} with pitch ${n.pitch} failed to play. Ignoring it`
      );
    } finally {
      buttonUp(0);
    }

    sequence.addPitch(n.pitch, n.endTime - n.startTime, { tag: AI_TURN });
  }

  /**
   * Removes the child element 'elem' from the infoContainer element.
   * Then calls the addActionBox() function, presumably to add a new action box element.
   */
  infoContainer.removeChild(elem);
  addActionBox();
};
/**
 * Handles a piano key press down event.
 * - Plays note audio
 * - Highlights piano key
 * - Renders floating note visual
 * - Starts timer for AI turn
 * - Stores data mappings for key press
 */
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

  /**
   * Generates a random note from the key whitelist using the Genie model
   * with the given temperature hyperparameter. Maps the note to a piano
   * key pitch value. Sets the pitch and start time on the currentPressedKey
   * object to track the key press.
   */
  const note = genie.nextFromKeyWhitelist(
    BUTTON_MAPPING[button],
    keyWhitelist,
    TEMPERATURE
  );
  const pitch = CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + note;
  currentPressedKey.pitch = pitch;
  currentPressedKey.startTime = new Date().getTime();
  try {
    /** Plays a piano note down audio given the pitch and button pressed */
    pianoPlayer.playNoteDown(pitch, button);
  } catch (error) {
    console.warn(
      `note ${note} with pitch ${pitch} failed to play. Ignoring it`
    );
  }
  /**
   * Starts a timer that will trigger the AI's turn after the specified number of seconds.
   * When the timer expires, it calls the aiTurn() function to generate the AI's next note.
   */
  timer.start(async () => {
    await aiTurn();
  }, timerSeconds);
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

/**
 * buttonUp is called when a piano key is released.
 * It handles updating the UI, stopping any sounds,
 * and tracking the note release if it's the user's turn.
 */
function buttonUp(button) {
  const el = document.getElementById(`btn${button}`);
  if (!el) return;
  el.removeAttribute("active");

  /**
   * Gets the visual data associated with the button that was pressed from the map.
   * This allows access to the rectangle element that highlights the piano key,
   * as well as the Note object that handles the painting animation.
   */
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
/**
 * Handles key down events to play notes on the piano.
 * Checks for sustain pedal presses, reset signals, and key presses
 * to map to piano buttons and call buttonDown.
 */
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

/**
 * Handles key up events to stop notes playing on the piano.
 * Checks for sustain pedal releases, and key releases
 * to map to piano buttons and call buttonUp.
 */
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

/**
 * Handles resizing the piano when the window is resized.
 * Calculates the number of octaves and total notes to show based on window width.
 * Resizes the piano and painter canvases.
 * Updates the key whitelist for mapping keyboard inputs.
 * Redraws the piano.
 */
function onWindowResize() {
  /**
   * Sets the number of octaves to show on the piano based on the window width.
   * Uses a ternary operator to show 7 octaves if the window is wider than 700px,
   * otherwise shows 3 octaves.
   */
  OCTAVES = window.innerWidth > 700 ? 7 : 3;
  const bonusNotes = OCTAVES > 6 ? 4 : 0; // starts on an A, ends on a C.
  const totalNotes = CONSTANTS.NOTES_PER_OCTAVE * OCTAVES + bonusNotes;
  /**
   * Calculates the total number of white notes to display on the piano.
   * Multiplies the number of white notes per octave by the number of octaves,
   * and adds the number of bonus notes minus 1 (to exclude the final black note).
   */
  const totalWhiteNotes =
    CONSTANTS.WHITE_NOTES_PER_OCTAVE * OCTAVES + (bonusNotes - 1);
  /**
   * Generates a whitelist array mapping keyboard inputs
   * to piano key indexes based on the number of total notes calculated.
   * Filters out notes that would fall below the range of the piano based on the number of octaves.
   * On small screens with only 3 octaves, starts mapping from the 4th note (C)
   * and shifts all notes up by 1 octave.
   */
  keyWhitelist = Array(totalNotes)
    .fill()
    .map((x, i) => {
      if (OCTAVES > 6) return i;
      // Starting 3 semitones up on small screens (on a C), and a whole octave up.
      return i + 3 + CONSTANTS.NOTES_PER_OCTAVE;
    });

  /**
   * Resizes the piano canvas to fit the calculated number of white keys.
   * Resizes the painter canvas to match the new piano key height.
   * Redraws the piano with the updated dimensions.
   */
  piano.resize(totalWhiteNotes);
  painter.resize(piano.config.whiteNoteHeight);
  piano.draw();
}

/*************************
 * Utils and helpers
 ************************/
/**
 * Gets the button index from a key code.
 * @param {string} key - The key code string.
 * @returns {number|null} The button index if found, null otherwise.
 */
function getButtonFromKeyCode(key) {
  /**
   * Checks if the key pressed is a number from 1 to NUM_BUTTONS,
   * which represents the numeric buttons on the device.
   * If yes, returns the button index, zero-indexed,
   * by subtracting 1 from the key value.
   */
  if (key >= "1" && key <= String(NUM_BUTTONS)) {
    return parseInt(key) - 1;
  }

  /**
   * Checks if the provided key is in the BUTTONS_MAKEY or BUTTONS_DEVICE arrays
   * depending on the isUsingMakey flag. Returns the index if found, null otherwise.
   * This allows mapping keyboard inputs to button indexes.
   */
  const index = isUsingMakey
    ? BUTTONS_MAKEY.indexOf(key)
    : BUTTONS_DEVICE.indexOf(key);
  return index !== -1 ? index : null;
}


/**
 * Updates the text displayed on the piano button elements.
 * Loops through each button and sets the innerHTML to show the mapped keyboard/Makey Makey button,
 * depending on isUsingMakey flag.
 */
function updateButtonText() {
  const btns = document.querySelectorAll(".controls button.color");
  for (let i = 0; i < btns.length; i++) {
    btns[i].innerHTML = isUsingMakey
      ? `<span>${BUTTONS_MAKEY_DISPLAY[i]}</span>`
      : `<span>${i + 1}</span><br><span>${BUTTONS_DEVICE[i]}</span>`;
  }
}
