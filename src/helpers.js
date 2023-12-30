/**
 * CONSTANTS
 *
 * Object containing constant values used throughout the application.
 *
 * - COLORS: Array of color strings used for piano key styling
 * - NUM_BUTTONS: Number of piano keys to display
 * - NOTES_PER_OCTAVE: Number of notes in a piano octave
 * - WHITE_NOTES_PER_OCTAVE: Number of white keys in a piano octave
 * - LOWEST_PIANO_KEY_MIDI_NOTE: MIDI note number of the lowest piano key
 * - GENIE_CHECKPOINT: URL to access the Magenta piano genie model
 */
const CONSTANTS = {
  COLORS: [
    "#EE2B29",
    "#ff9800",
    "#ffff00",
    "#c6ff00",
    "#00e5ff",
    "#2979ff",
    "#651fff",
    "#d500f9",

    "#4CAF50", // AI Colors
  ],
  NUM_BUTTONS: 8,
  NOTES_PER_OCTAVE: 12,
  WHITE_NOTES_PER_OCTAVE: 7,
  LOWEST_PIANO_KEY_MIDI_NOTE: 21,
  GENIE_CHECKPOINT:
    "https://storage.googleapis.com/magentadata/js/checkpoints/piano_genie/model/epiano/stp_iq_auto_contour_dt_166006",
};

/**
 * Magenta player class to handle audio playback and interaction with Magenta models.
 *
 * Has methods to:
 * - Load instrument samples
 * - Play/stop notes using WebAudio or by sending MIDI messages
 * - Start/stop Magenta model sequence playback
 * - Check if a sequence is currently playing
 */
class Player {
  /**
   * Constructor for the Player class.
   *
   * Initializes:
   * - this.player: Magenta SoundFontPlayer instance
   * - this.midiOut/this.midiIn: MIDI input/output port arrays
   * - this.usingMidiOut/this.usingMidiIn: Booleans tracking if MIDI is enabled
   * - this.selectOut/InElement: DOM elements for MIDI port selects
   * - Calls this.loadAllSamples() to load instrument samples
   */
  constructor() {
    this.player = new mm.SoundFontPlayer(
      "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
    );
    this.midiOut = [];
    this.midiIn = [];
    this.usingMidiOut = false;
    this.usingMidiIn = false;
    this.selectOutElement = document.getElementById("selectOut");
    this.selectInElement = document.getElementById("selectIn");
    this.loadAllSamples();
  }

  /**
   * Loads all instrument samples into the player by constructing a sequence
   * with notes corresponding to all piano keys, and passing it to loadSamples().
   */
  loadAllSamples() {
    const seq = { notes: [] };
    for (let i = 0; i < CONSTANTS.NOTES_PER_OCTAVE * OCTAVES; i++) {
      seq.notes.push({ pitch: CONSTANTS.LOWEST_PIANO_KEY_MIDI_NOTE + i });
    }
    this.player.loadSamples(seq);
  }

  /**
   * Plays a note down event, sending the note on message over MIDI if enabled,
   * or playing the note with the Magenta player.
   * @param {number} pitch - The MIDI pitch number of the note to play.
   * @param {Object} button - The button element that was clicked to play the note.
   */
  playNoteDown(pitch, button) {
    // Send to MIDI out or play with the Magenta player.
    if (this.usingMidiOut) {
      this.sendMidiNoteOn(pitch, button);
    } else {
      mm.Player.tone.context.resume();
      this.player.playNoteDown({ pitch: pitch });
    }
  }

  /**
   * Plays a note up event, sending the note off message over MIDI if enabled,
   * or stopping the note with the Magenta player.
   * @param {number} pitch - The MIDI pitch number of the note to stop playing.
   * @param {Object} button - The button element that was released to stop the note.
   */
  playNoteUp(pitch, button) {
    // Send to MIDI out or play with the Magenta player.
    if (this.usingMidiOut) {
      this.sendMidiNoteOff(pitch, button);
    } else {
      this.player.playNoteUp({ pitch: pitch });
    }
  }

  /**
   * Starts playing the sequence from the given sequencer.
   * @param {Sequencer} sequencer - The sequencer containing the sequence to play.
   * @returns {Promise} A promise that resolves when playback starts.
   */
  async start(sequencer) {
    return this.player.start(sequencer.getSequence());
  }
  isPlaying = () => {
    return this.player.isPlaying();
  };

  /**
   * Stops playback if currently playing.
   */
  stop = () => {
    if (this.isPlaying()) {
      this.player.stop();
    }
  };
}

/**
 * FloatyNotes handles the animation of notes floating up from piano keys.
 * It stores a list of active notes, draws them on a canvas, advances their
 * position each frame, and removes notes that move off screen.
 */
class FloatyNotes {
  /**
   * Constructor for FloatyNotes class.
   * Initializes canvas and drawing context.
   * Sets initial state for notes array, canvas, drawing context, and context height.
   */
  constructor() {
    this.notes = []; // the notes floating on the screen.

    this.canvas = document.getElementById("canvas");
    this.context = this.canvas.getContext("2d");
    this.context.lineWidth = 4;
    this.context.lineCap = "round";

    this.contextHeight = 0;
  }

  /**
   * Resizes the canvas to fill the window, adjusting the height based on the
   * height of the white piano keys.
   *
   * @param {number} whiteNoteHeight - Height of the white piano keys
   */
  resize(whiteNoteHeight) {
    this.canvas.width = window.innerWidth;
    this.canvas.height = this.contextHeight =
      window.innerHeight - whiteNoteHeight - 20;
  }

  /**
   * Adds a new note to the notes array to be animated and rendered.
   *
   * @param {number} button - Index of the piano key color in the COLORS array
   * @param {number} x - X position to draw the note
   * @param {number} width - Width of the note rectangle
   * @returns {Object} The new note object that was added
   */
  addNote(button, x, width) {
    const noteToPaint = {
      x: parseFloat(x),
      y: 0,
      width: parseFloat(width),
      height: 0,
      color: CONSTANTS.COLORS[button],
      on: true,
    };
    this.notes.push(noteToPaint);
    return noteToPaint;
  }

  /**
   * Stops the animation of a note by setting its "on" property to false.
   *
   * @param {Object} noteToPaint - The note object to stop animating.
   */
  stopNote(noteToPaint) {
    noteToPaint.on = false;
  }

  /**
   * The drawLoop function handles animating all the note rectangles that have been added.
   * It runs in a requestAnimationFrame loop to smoothly animate the notes moving up and down.
   * The function clears the canvas, removes notes that have scrolled off screen, moves all
   * active notes up by a small delta, fades notes out as they reach the bottom, and redraws
   * all the rectangles in their new positions.
   */
  drawLoop() {
    const dy = 3;
    this.context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Remove all the notes that will be off the page;
    this.notes = this.notes.filter(
      (note) => note.on || note.y < this.contextHeight - 100
    );

    // Advance all the notes.
    for (let i = 0; i < this.notes.length; i++) {
      const note = this.notes[i];

      // If the note is still on, then its height goes up but it
      // doesn't start sliding down yet.
      if (note.on) {
        note.height += dy;
      } else {
        note.y += dy;
      }

      this.context.globalAlpha = 1 - note.y / this.contextHeight;
      this.context.fillStyle = note.color;
      this.context.fillRect(note.x, note.y, note.width, note.height);
    }
    window.requestAnimationFrame(() => this.drawLoop());
  }
}

/**
 * Piano class representing a piano keyboard.
 */
class Piano {
  /**
   * Constructor for Piano class.
   * Initializes configuration values for note widths and heights.
   * Gets references to SVG element and SVG namespace.
   */
  constructor() {
    this.config = {
      whiteNoteWidth: 20,
      blackNoteWidth: 20,
      whiteNoteHeight: 70,
      blackNoteHeight: (2 * 70) / 3,
    };

    this.svg = document.getElementById("svg");
    this.svgNS = "http://www.w3.org/2000/svg";
  }

  /**
   * Resizes the piano to fit the browser window width.
   * Calculates the width of white and black notes based on the total
   * number of white notes that need to be rendered and the window width.
   * Also sets the SVG element width and height.
   */
  resize(totalWhiteNotes) {
    // i honestly don't know why some flooring is good and some is bad sigh.
    const ratio = window.innerWidth / totalWhiteNotes;
    this.config.whiteNoteWidth = OCTAVES > 6 ? ratio : Math.floor(ratio);
    this.config.blackNoteWidth = (this.config.whiteNoteWidth * 2) / 3;
    this.svg.setAttribute("width", window.innerWidth);
    this.svg.setAttribute("height", this.config.whiteNoteHeight);
  }

  /**
   * Draws the piano keyboard by creating SVG rectangle elements
   * for each piano key. Handles both white and black keys, positioning
   * them correctly based on provided configuration. Loops through the
   * number of octaves, notes per octave, and handles black key positions
   * separately. Updates the SVG contents and element sizing.
   */
  draw() {
    this.svg.innerHTML = "";
    const halfABlackNote = this.config.blackNoteWidth / 2;
    let x = 0;
    let y = 0;
    let index = 0;

    const blackNoteIndexes = [1, 3, 6, 8, 10];

    // First draw all the white notes.
    // Pianos start on an A (if we're using all the octaves);
    if (OCTAVES > 6) {
      this.makeRect(
        0,
        x,
        y,
        this.config.whiteNoteWidth,
        this.config.whiteNoteHeight,
        "white",
        "#141E30"
      );
      this.makeRect(
        2,
        this.config.whiteNoteWidth,
        y,
        this.config.whiteNoteWidth,
        this.config.whiteNoteHeight,
        "white",
        "#141E30"
      );
      index = 3;
      x = 2 * this.config.whiteNoteWidth;
    } else {
      // Starting 3 semitones up on small screens (on a C), and a whole octave up.
      index = 3 + CONSTANTS.NOTES_PER_OCTAVE;
    }

    // Draw the white notes.
    for (let o = 0; o < OCTAVES; o++) {
      for (let i = 0; i < CONSTANTS.NOTES_PER_OCTAVE; i++) {
        if (blackNoteIndexes.indexOf(i) === -1) {
          this.makeRect(
            index,
            x,
            y,
            this.config.whiteNoteWidth,
            this.config.whiteNoteHeight,
            "white",
            "#141E30"
          );
          x += this.config.whiteNoteWidth;
        }
        index++;
      }
    }

    if (OCTAVES > 6) {
      // And an extra C at the end (if we're using all the octaves);
      this.makeRect(
        index,
        x,
        y,
        this.config.whiteNoteWidth,
        this.config.whiteNoteHeight,
        "white",
        "#141E30"
      );

      // Now draw all the black notes, so that they sit on top.
      // Pianos start on an A:
      this.makeRect(
        1,
        this.config.whiteNoteWidth - halfABlackNote,
        y,
        this.config.blackNoteWidth,
        this.config.blackNoteHeight,
        "black"
      );
      index = 3;
      x = this.config.whiteNoteWidth;
    } else {
      // Starting 3 semitones up on small screens (on a C), and a whole octave up.
      index = 3 + CONSTANTS.NOTES_PER_OCTAVE;
      x = -this.config.whiteNoteWidth;
    }

    // Draw the black notes.
    for (let o = 0; o < OCTAVES; o++) {
      for (let i = 0; i < CONSTANTS.NOTES_PER_OCTAVE; i++) {
        if (blackNoteIndexes.indexOf(i) !== -1) {
          this.makeRect(
            index,
            x + this.config.whiteNoteWidth - halfABlackNote,
            y,
            this.config.blackNoteWidth,
            this.config.blackNoteHeight,
            "black"
          );
        } else {
          x += this.config.whiteNoteWidth;
        }
        index++;
      }
    }
  }

  /**
   * Highlights a note on the piano roll UI by finding the corresponding SVG rect element and setting its "active" and "class" attributes.
   *
   * @param {number} note - The MIDI note number to highlight
   * @param {string} button - The color class to set on the rect element
   * @returns {SVGRectElement} The highlighted rect element
   */
  highlightNote(note, button) {
    // Show the note on the piano roll.
    const rect = this.svg.querySelector(`rect[data-index="${note}"]`);
    if (!rect) {
      console.log("couldnt find a rect for note", note);
      return;
    }
    rect.setAttribute("active", true);
    rect.setAttribute("class", `color-${button}`);
    return rect;
  }

  /**
   * Clears the highlight styling from a note rectangle element.
   *
   * @param {SVGRectElement} rect - The note rectangle element to clear
   */
  clearNote(rect) {
    rect.removeAttribute("active");
    rect.removeAttribute("class");
  }

  /**
   * Creates an SVG rect element and appends it to the SVG container.
   *
   * @param {number} index - The data index to assign to the rect
   * @param {number} x - The x position of the rect
   * @param {number} y - The y position of the rect
   * @param {number} w - The width of the rect
   * @param {number} h - The height of the rect
   * @param {string} fill - The fill color of the rect
   * @param {string} [stroke] - An optional stroke color for the rect
   */
  makeRect(index, x, y, w, h, fill, stroke) {
    const rect = document.createElementNS(this.svgNS, "rect");
    rect.setAttribute("data-index", index);
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", w);
    rect.setAttribute("height", h);
    rect.setAttribute("fill", fill);
    if (stroke) {
      rect.setAttribute("stroke", stroke);
      rect.setAttribute("stroke-width", "3px");
    }
    this.svg.appendChild(rect);
    return rect;
  }
}

/**
 * MusicSequence handles storing and manipulating musical note data.
 * Can add notes with pitch, duration, lowest piano key MIDI number, and tag.
 * Keeps track of start/end times and total time.
 * Provides methods to get notes, check if empty, clear, etc.
 */
class MusicSequence {
  /**
   * Constructor for MusicSequence class.
   * Initializes empty arrays to store note data,
   * and sets totalTime property to 0 to track sequence duration.
   */
  constructor() {
    this.notes = [];
    this._all = [];
    this.totalTime = 0;
  }

  /**
   * Adds a note to the sequence.
   * @param {number} pitch - The MIDI pitch value of the note
   * @param {number} duration - The duration of the note in seconds
   * @param {Object} options - Additional options
   * @param {number} [options.lowestPianoKeyMidiNote=0] - The MIDI note number of the lowest piano key
   * @param {string} [options.tag=""] - An optional tag to associate with the note
   */
  addPitch(pitch, duration, { lowestPianoKeyMidiNote = 0, tag = "" }) {
    pitch += lowestPianoKeyMidiNote;
    const startTime = this.totalTime;
    const endTime = startTime + duration;
    const n = { pitch, startTime, endTime, tag };
    this.notes.push(n);
    this._all.push(n);
    this.totalTime = endTime;
  }
  /**
   * Gets the last note from the sequence.
   * @returns {Object} The last note object without the tag property.
   */
  getLastNote = () => {
    return this._getNotesWithoutTag(this.notes)[this.notes.length - 1];
  };
  /**
   * Gets the sequence of notes.
   * @param {boolean} [onlyActive=true] - Whether to only return active notes or all notes including inactive ones
   * @returns {Object} An object with the array of notes and the total time
   */
  getSequence = (onlyActive = true) => {
    const repo = onlyActive ? this.notes : this._all;
    return {
      notes: this._getNotesWithoutTag(repo),
      totalTime: this.notes[repo.length - 1]?.endTime ?? 0,
    };
  };
  /**
   * Gets the sequence of notes filtered by the provided tag.
   * @param {string} tag - The tag to filter notes by
   * @param {boolean} [onlyActive=true] - Whether to only return active notes or all notes including inactive ones
   * @returns {Object} An object with the array of filtered notes and the total time
   */
  getSequencesByTag = (tag, onlyActive = true) => {
    const repo = onlyActive ? this.notes : this._all;
    if (!tag) {
      console.warn(
        "tag is not provided while quering sequences by tag, returning all notes"
      );
      return this._getNotesWithoutTag(repo);
    }
    const notes = this._getNotesWithoutTag(
      repo.filter((note) => note.tag === tag)
    );
    return {
      notes,
      totalTime: notes[notes.length - 1]?.endTime ?? 0,
    };
  };
  /**
   * Checks if there are no notes in the sequence.
   * @returns {boolean} True if there are no notes, false otherwise.
   */
  isEmpty = () => {
    return this.notes.length === 0;
  };
  /**
   * Clears the sequence by resetting the notes array and total time.
   */
  clear = () => {
    /**
     * Clears the sequence by resetting the notes array and total time.
     * _getNotesWithoutTag is a private helper function that returns a copy
     * of the notes array without the tag property to prevent mutation.
     */
    this.notes = [];
    this.totalTime = 0;
  };
  _getNotesWithoutTag = (notes) => {
    return notes.map((note) => {
      return {
        pitch: note.pitch,
        startTime: note.startTime,
        endTime: note.endTime,
      };
    });
  };
}

/**
 * Timer class to start, pause, resume and reset a countdown timer.
 * Handles creating the timer UI element, updating the countdown,
 * and calling a callback when the timer expires.
 */
class Timer {
  /**
   * Constructor for Timer class
   * Initializes timer properties:
   * - timerContainer: DOM element to display timer info
   * - isRunning: boolean tracking if timer is running
   * - interval: timer interval ID
   * - currentTime: current remaining time in seconds
   */
  constructor() {
    this.timerContainer = document.getElementById("info-container");
    this.isRunning = false;
    this.interval = null;
    this.currentTime = 0;
  }
  /**
   * Starts the countdown timer.
   * @param {Function} callback - Optional callback function to call when timer expires
   * @param {number} seconds - Number of seconds to set the timer for
   */
  start = (callback, seconds) => {
    if (this.isRunning) return;
    this.currentTime = seconds;
    this.isRunning = true;

    this.timerContainer.innerHTML = "";
    this.toggleTimer();

    const pElement = document.createElement("p");
    pElement.className = "info-text";
    pElement.textContent = seconds;
    this.timerContainer.appendChild(pElement);

    this.interval = setInterval(() => {
      pElement.textContent = this.currentTime - 1;
      if (this.currentTime === 0) {
        this.timerContainer.removeChild(pElement);
        this.reset();
        if (callback && typeof callback === "function") callback();
      } else {
        this.currentTime--;
      }
    }, 1000);
  };
  /**
   * Resets the timer by:
   * 1. Clearing the interval
   * 2. Setting isRunning to false
   * 3. Setting interval to null
   * 4. Hiding the timer UI
   */
  reset = () => {
    this.clear();

    this.isRunning = false;
    this.interval = null;
    this.toggleTimer();
  };
  /**
   * Toggles the display style of the timer container
   * element between block and none, depending on
   * whether the timer is currently running.
   */
  toggleTimer = () => {
    this.timerContainer.style.display = this.isRunning ? "block" : "none";
  };
  /**
   * Clears the timer interval if the timer is running.
   * Warns if trying to clear when timer not running.
   */
  clear = () => {
    if (!this.isRunning || !this.interval) {
      console.warn(
        "Cannot clear: Timer is not running or interval is undefined"
      );
      return;
    }
    clearInterval(this.interval);
  };
}
