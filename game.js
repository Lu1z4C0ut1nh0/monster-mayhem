/*
  ================================================================
  MONSTER MAYHEM — game.js
  ================================================================
  This file contains ALL the game logic.
  It is structured in order from basic building blocks up to the
  complete running game. Read it top to bottom.

  CONTENTS:
    1. Grid configuration constants
    2. Hexagon maths — how to calculate corners
    3. Grid maths — how to position hexagons in a grid
    4. SVG creation — how to build the board in the browser
    5. Game state — tracking what the player has selected
    6. Event handlers — responding to hover and click
    7. Initialisation — starting the game

  KEY CONCEPTS USED:
    - Variables (const, let)
    - Loops (for)
    - Functions
    - Math (trigonometry)
    - The DOM (creating and editing HTML/SVG elements)
    - Events (mouseenter, mouseleave, click)
  ================================================================
*/


/* ============================================================
   SECTION 1 — GRID CONFIGURATION
   ============================================================
   These are constants — values we decide once and never change.
   Using "const" instead of "let" prevents accidental reassignment.
   Naming them clearly (GRID_COLS not just 10) makes the code
   self-documenting — easy to read and modify later.
   ============================================================ */

const GRID_COLS = 10;    // Number of hexagons across (columns)
const GRID_ROWS = 10;    // Number of hexagons down (rows)
const HEX_SIZE  = 28;    // "Circumradius" — distance from centre to each corner (in pixels)
const PADDING   = 36;    // Empty space around the edge of the grid (in pixels)

/* ============================================================
   SECTION 1B — TILE TYPES
   ============================================================
   We define each tile type as an object with a name and image.
   Storing them in an array lets us pick one by index number.

   Each hex in the grid is assigned a tile type when the grid
   is built. We store this in a 2D array called TILE_MAP so
   we can look up any hex's type by [row][col].
   ============================================================ */

const TILE_TYPES = [
  { name: 'grass',   img: 'Assets/0001s-0001-Layer-0-copy.png',    sound: new Audio('Assets/jump.wav')    },
  { name: 'mold',   img: 'Assets/0001s-0010-Layer-0-copy-10.png', sound: new Audio('Assets/jump.wav')    },
  { name: 'crystal', img: 'Assets/0001s-0023-Layer-0-copy-23.png', sound: new Audio('Assets/coin.wav') }
];

/*
  generateTileMap()
  ─────────────────
  Randomly assigns a tile type to every hex in the grid.
  Returns a 2D array: TILE_MAP[row][col] = a TILE_TYPES index.

  Math.random() gives a number between 0 and 1.
  Multiplying by TILE_TYPES.length and flooring it gives
  a random whole number between 0 and 2 — a valid tile index.
*/
function generateTileMap() {
  const map = [];

  /*
    STEP 1 — Build a flat list of all hex positions.
    We need to pick 5 random positions from the entire 100-hex grid.
    The easiest way is to put every position in an array first,
    then shuffle it and take the first 5.
  */
  const allPositions = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      allPositions.push({ row, col });
    }
  }

  /*
    STEP 2 — Fisher-Yates shuffle.
    This is the standard algorithm for randomly shuffling an array.
    It works by looping backwards and swapping each item with a
    random earlier item — guaranteeing every order is equally likely.
  */
  for (let i = allPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
  }

  // Take the first 5 positions after shuffling — these become crystals
  const safePositions = allPositions.filter(
  pos => !(pos.row === 0 && pos.col === 0)
);

const crystalPositions = safePositions.slice(0, 5);

  /*
    STEP 3 — Build the map.
    Check each hex against the crystal list.
    Everything else is random grass or water.
  */
  for (let row = 0; row < GRID_ROWS; row++) {
    map[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      const isCrystal = crystalPositions.some(
        pos => pos.row === row && pos.col === col
      );
      map[row][col] = isCrystal ? 2 : (Math.random() < 0.55 ? 0 : 1);
    }
  }

  return map;
}

// Generate the tile map once — stored globally so all functions can read it
const TILE_MAP = generateTileMap();

/* ============================================================
   SECTION 2 — HEXAGON MATHS
   ============================================================
   A hexagon has 6 corners (vertices). To draw one, we need to
   calculate the (x, y) position of each corner.

   We use "pointy-top" orientation (one tip faces upward).

   The maths uses trigonometry (cos and sin) — the same functions
   that describe circles. A hexagon's corners are evenly spaced
   around a circle at 60° intervals (360° ÷ 6 = 60°).

   For POINTY-TOP, we START the first corner at 30° (not 0°).
   This rotates all corners so one tip faces upward.

   Degrees → Radians conversion:
     radians = degrees × (π ÷ 180)
   We must convert because Math.cos() and Math.sin() take radians.
   ============================================================ */

const SQRT3 = Math.sqrt(3);  // √3 ≈ 1.732 — used repeatedly in hex grid maths


/*
  getHexCorners(cx, cy)
  ─────────────────────
  Given the CENTRE of a hexagon (cx, cy),
  returns an array of 6 corner points [{x, y}, ...].

  Each corner is at angle (30 + 60×i)° from the centre,
  at distance HEX_SIZE.
*/
function getHexCorners(cx, cy) {
  const corners = [];

  for (let i = 0; i < 6; i++) {
    // Angle for this corner, in degrees
    const angleDeg = 30 + 60 * i;

    // Convert degrees to radians (required by Math.cos / Math.sin)
    const angleRad = (Math.PI / 180) * angleDeg;

    // Calculate the corner position using trigonometry:
    //   x = centre_x + radius × cos(angle)
    //   y = centre_y + radius × sin(angle)
    corners.push({
      x: cx + HEX_SIZE * Math.cos(angleRad),
      y: cy + HEX_SIZE * Math.sin(angleRad)
    });
  }

  return corners;
}


/*
  cornersToPointsString(corners)
  ──────────────────────────────
  SVG <polygon> elements need their points in a specific text format:
    "x1,y1 x2,y2 x3,y3 ..."

  This function takes our array of corner objects and converts them
  into that string. We round to 2 decimal places to keep the SVG tidy.

  Example output: "28,14 52.5,28 52.5,56 28,70 3.5,56 3.5,28"
*/
function cornersToPointsString(corners) {
  return corners
    .map(corner => `${corner.x.toFixed(2)},${corner.y.toFixed(2)}`)
    .join(' ');
}


/* ============================================================
   SECTION 3 — HEX GRID LAYOUT MATHS
   ============================================================
   Now we know how to draw ONE hexagon, we need to place 100 of them
   in a 10×10 grid so they fit together with no gaps.

   Key measurements for a POINTY-TOP hex of circumradius s:
     Width  (flat edge to flat edge) = √3 × s
     Height (tip to tip)             = 2  × s

   Spacing between centres:
     Horizontal (column to column): √3 × s        (= full width)
     Vertical   (row to row):       1.5 × s       (rows overlap slightly)

   The overlap trick:
     Hexagons don't stack directly above each other.
     Instead, ODD rows are shifted RIGHT by half a hex-width.
     This creates the classic brick-like interlocking pattern.

                 col0    col1    col2
   row0 (even)   [hex]   [hex]   [hex]
   row1 (odd)       [hex]   [hex]   [hex]
   row2 (even)   [hex]   [hex]   [hex]
   ============================================================ */

// Horizontal distance between hex centres (one column apart)
const COL_SPACING = SQRT3 * HEX_SIZE;          // ≈ 48.5 px

// Vertical distance between hex centres (one row apart)
const ROW_SPACING = HEX_SIZE * 1.5;            // = 42 px

// How much odd rows are shifted right to interlock with even rows
const ODD_ROW_OFFSET = COL_SPACING / 2;        // ≈ 24.25 px


/*
  getHexCenter(col, row)
  ──────────────────────
  Given a grid position (col, row) — both starting from 0 —
  returns the pixel position {x, y} of that hexagon's centre.

  This is where the "interlocking" offset is applied:
  if the row number is odd (1, 3, 5...), we shift x right.
*/
function getHexCenter(col, row) {
  // x: move right by one column-spacing for each column
  //    if this is an odd row, add the offset so hexes interlock
  const offsetX = (row % 2 === 1) ? ODD_ROW_OFFSET : 0;
  const x = PADDING + col * COL_SPACING + offsetX;

  // y: move down by one row-spacing for each row
  const y = PADDING + row * ROW_SPACING;

  return { x, y };
}


/* ============================================================
   SECTION 4 — SVG CREATION
   ============================================================
   SVG (Scalable Vector Graphics) is a way to draw shapes in the browser.
   We create SVG elements with JavaScript using:
     document.createElementNS(namespace, tagName)

   The namespace is always "http://www.w3.org/2000/svg" for SVG.
   This is different from regular HTML elements (which use document.createElement).
   ============================================================ */

// SVG namespace — required when creating SVG elements with JavaScript
const SVG_NS = 'http://www.w3.org/2000/svg';


/*
  calculateSVGSize()
  ──────────────────
  Works out how large the SVG canvas needs to be to fit the entire grid.
  We calculate the rightmost and bottommost hex, then add padding.
*/
function calculateSVGSize() {
  // Find the centre of the last hex in the last row
  const lastColCenter = getHexCenter(GRID_COLS - 1, GRID_ROWS - 1);

  // Total width: centre of last column + half a hex width + padding
  const svgWidth  = lastColCenter.x + COL_SPACING / 2 + PADDING;

  // Total height: centre of last row + half a hex height + padding
  const svgHeight = lastColCenter.y + HEX_SIZE + PADDING;

  return { svgWidth, svgHeight };
}


/*
  createHexPolygon(col, row)
  ──────────────────────────
  Creates a single SVG <polygon> element for the hexagon at (col, row).

  Steps:
    1. Calculate the centre position of this hex in pixels
    2. Calculate its 6 corner points
    3. Create an SVG <polygon> DOM element
    4. Set its "points" attribute (the corner positions)
    5. Set its "class" to "hex" (so CSS styles are applied)
    6. Store the col/row in data attributes (so we know which hex was clicked)

  Returns the <polygon> element.
*/
function createHexPolygon(col, row) {
  // Get centre position
  const center  = getHexCenter(col, row);

  // Get the 6 corners around that centre
  const corners = getHexCorners(center.x, center.y);

  // Convert corners to the SVG "points" string format
  const pointsString = cornersToPointsString(corners);

  // Create the SVG polygon element
  const polygon = document.createElementNS(SVG_NS, 'polygon');

  // Set the shape (the 6 corners we calculated)
  polygon.setAttribute('points', pointsString);

  // Apply the CSS class "hex" (this triggers our CSS styles)
  polygon.setAttribute('class', 'hex');

  // Store the grid position as data attributes.
  // This lets us look up which hex was interacted with in event handlers.
  // "data-col" and "data-row" are custom HTML data attributes.
  polygon.dataset.col = col;
  polygon.dataset.row = row;

  return polygon;
}


/*
  buildGrid()
  ───────────
  Creates the entire SVG board and inserts it into the #board div.

  Steps:
    1. Create an <svg> element
    2. Set its width and height
    3. Loop through all rows and columns
    4. Create a polygon for each hex and add it to the SVG
    5. Attach event listeners to each polygon
    6. Insert the finished SVG into the page
*/
function buildGrid() {
  // Calculate the total SVG canvas size needed
  const { svgWidth, svgHeight } = calculateSVGSize();

  // Create the SVG container element
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width',   svgWidth);
  svg.setAttribute('height',  svgHeight);
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {

      // Look up which tile type this hex is assigned
      const tileIndex = TILE_MAP[row][col];
      const tile      = TILE_TYPES[tileIndex];
      const center    = getHexCenter(col, row);

      // Draw the tile IMAGE first — SVG layers in order,
      // so anything added first appears BEHIND things added later
      const tileImg = document.createElementNS(SVG_NS, 'image');
      tileImg.setAttribute('href',   tile.img);
      tileImg.setAttribute('x',      center.x - HEX_SIZE * 1.1);
      tileImg.setAttribute('y',      center.y - HEX_SIZE * 1.1);
      tileImg.setAttribute('width',  HEX_SIZE * 2.2);
      tileImg.setAttribute('height', HEX_SIZE * 2.2);
      tileImg.setAttribute('pointer-events', 'none');
      tileImg.setAttribute('data-tile-col', col);  
      tileImg.setAttribute('data-tile-row', row);
      svg.appendChild(tileImg);

      // Then draw the transparent polygon ON TOP
      // (receives mouse events, image shows through underneath)
      const polygon = createHexPolygon(col, row);
      polygon.addEventListener('mouseenter', onHexHover);
      polygon.addEventListener('mouseleave', onHexLeave);
      polygon.addEventListener('click',      onHexClick);
      svg.appendChild(polygon);
    }
  }

  // ← These three lines are critical — don't delete them!
  const boardDiv = document.getElementById('board');
  boardDiv.appendChild(svg);  // Adds the finished SVG to the page
  gameSVG = svg;              // Saves reference for the character sprite
}


/* ============================================================
   SECTION 5 — GAME STATE
   ============================================================
   "State" means the current status of the game at any moment.
   We track two things:
     - Which hex is currently hovered (mouse is over it)
     - Which hex is currently selected (player clicked it)

   We store these as references to the actual polygon DOM elements,
   or null if nothing is hovered/selected.
   ============================================================ */

let hoveredHex  = null;   // The <polygon> the cursor is currently over
let selectedHex = null;   // The <polygon> the player last clicked


/* ============================================================
   SECTION 6 — EVENT HANDLERS
   ============================================================
   Event handlers are functions that run in response to user actions.
   We use three events:
     - mouseenter  : fires when the cursor enters a hex
     - mouseleave  : fires when the cursor leaves a hex
     - click       : fires when the player clicks a hex

   In each handler, "event" (or "e") is automatically passed in by the
   browser. It contains information about the event, including
   event.target — the specific element that was interacted with.
   ============================================================ */


/*
  onHexHover(event)
  ─────────────────
  Called when the mouse enters a hexagon.

  1. Remove the "hovered" class from the previously hovered hex (if any)
  2. Add "hovered" class to the new hex
  3. Update the status bar text
*/
function onHexHover(event) {
  const hex = event.target;  // The specific polygon the mouse entered

  // Remove hover highlight from the last hex we were over
  if (hoveredHex !== null) {
    hoveredHex.classList.remove('hovered');
  }

  // Add hover highlight to the new hex
  hex.classList.add('hovered');

  // Remember which hex is currently hovered
  hoveredHex = hex;

  // Read the row/col we stored in the data attributes
  const col = hex.dataset.col;
  const row = hex.dataset.row;

  // Update the status bar — we add 1 to show 1-based numbers (more natural for players)
  updateStatus(`Hovering: Row ${parseInt(row) + 1}, Col ${parseInt(col) + 1}`);
}


/*
  onHexLeave(event)
  ─────────────────
  Called when the mouse leaves a hexagon.

  1. Remove the "hovered" class from the hex
  2. Clear the hoveredHex reference
  3. Reset the status bar (unless a hex is selected)
*/
function onHexLeave(event) {
  const hex = event.target;

  // Remove the hover highlight
  hex.classList.remove('hovered');

  // Nothing is hovered now
  hoveredHex = null;

  // Update status bar
  if (selectedHex !== null) {
    // If something is still selected, show that instead
    const col = selectedHex.dataset.col;
    const row = selectedHex.dataset.row;
    updateStatus(`Selected: Row ${parseInt(row) + 1}, Col ${parseInt(col) + 1}`);
  } else {
    updateStatus('Hover over a hex to begin...');
  }
}


/*
  onHexClick(event)
  ─────────────────
  Called when the player clicks a hexagon.

  Rules:
    - If this hex is NOT selected → select it
    - If this hex IS already selected → deselect it (toggle)
    - Only one hex can be selected at a time
*/
  function onHexClick(event) {
  const hex = event.target;
  const col = parseInt(hex.dataset.col);
  const row = parseInt(hex.dataset.row);

  const isCharacterHex = (col === characterPos.col && row === characterPos.row);

  if (isCharacterHex) {
    clearSelection();                    // ← replaces the manual clear
    hex.classList.add('selected');
    selectedHex = hex;
    playSound(ASSET_SOUND_SELECT);
    updateStatus('Monster selected — click any hex to move');
    updateInfoPanel(`Monster ready at Row ${row + 1}, Col ${col + 1}`);

  } else if (selectedHex !== null) {
    const path = findPath(characterPos.col, characterPos.row, col, row);
    updateStatus(`Moving... (${path.length} steps)`);
    animateAlongPath(path);              // clearSelection() is called inside here

  } else {
    const alreadySelected = (hex === selectedHex);
    clearSelection();                    // ← replaces the manual clear

    if (!alreadySelected) {
      hex.classList.add('selected');
      selectedHex = hex;
      updateStatus(`Selected: Row ${row + 1}, Col ${col + 1}`);
      updateInfoPanel(`Selected → Row: ${row + 1}  |  Col: ${col + 1}`);
    } else {
      updateStatus('Deselected.');
      updateInfoPanel('No hex selected');
    }
  }
}



/* ============================================================
   SECTION 7 — UI HELPER FUNCTIONS
   ============================================================
   Small reusable functions that update parts of the page.
   Keeping these separate avoids repeating the same code
   in every event handler.
   ============================================================ */


/*
  updateStatus(message)
  ──────────────────────
  Updates the text in the status bar above the board.
*/
function clearSelection() {
  if (selectedHex !== null) {
    selectedHex.classList.remove('selected');
    selectedHex = null;
  }
}
function updateStatus(message) {
  const statusBar = document.getElementById('status-bar');
  statusBar.textContent = message;
}


/*
  updateInfoPanel(message)
  ────────────────────────
  Updates the text in the info panel below the board.
*/
function updateInfoPanel(message) {
  const infoSpan = document.getElementById('selected-info');
  infoSpan.textContent = message;
}



document.addEventListener('DOMContentLoaded', function () {
  
  buildGrid();
  placeCharacter(0, 0); 
  updateScoreDisplay();   
  updateStatus('Click your monster to begin!');
 setFaviconFromFirstFrame();
});

/* ============================================================
   SECTION 8 — ASSETS
   ============================================================
   We load images and sounds once here, at the top level.
   Loading them once and reusing them is more efficient than
   creating a new Audio() object every time a sound plays.

   HOW SOUNDS WORK:
     new Audio('path/to/file.mp3') creates an audio object.
     .play() plays it from the start.
     We clone it with .cloneNode() before playing so that if the
     same sound triggers twice quickly, both play simultaneously.

   HOW IMAGES WORK IN SVG:
     We store the file path as a string.
     When we place the character, we create an SVG <image> element
     and set its href to this path.
   ============================================================ */

// File paths — change these to match your actual filenames
const ASSET_CHARACTER_IMG = 'Assets/Blue Idle - no slime.png';
const ASSET_SOUND_MOVE    = new Audio('Assets/jump.wav');
const ASSET_SOUND_SELECT  = new Audio('Assets/tap.wav');

/*
  playSound(audioObject)
  ──────────────────────
  Plays a sound effect.
  We use .cloneNode() so rapid repeated plays don't cancel each other.
  Without cloning, playing a sound while it's already playing
  would restart it instead of overlapping.
*/
function playSound(audioObject) {
  const clone = audioObject.cloneNode();
  clone.volume = 0.5;   // 50% volume — adjust between 0.0 and 1.0
  clone.play().catch(() => {
    // .catch() silently handles the browser blocking autoplay.
    // Browsers require a user interaction before playing audio —
    // since we only play on click/move, this is usually fine.
  });
}


/* ============================================================
   SECTION 9 — CHARACTER & MOVEMENT
   ============================================================
   The character is an SVG <image> element that sits on top of
   the hex grid. We track which hex it's on using characterHex —
   an object storing { col, row }.

   MOVEMENT RULES:
     - Click a hex that has no character → select it (existing behaviour)
     - Click a hex when a character hex is already selected → MOVE there
     - The character image is removed from the old hex and drawn on the new one

   HOW THE CHARACTER IS DRAWN:
     We create one SVG <image> element and store it in characterSprite.
     To move it, we just update its x and y attributes — no need to
     delete and recreate it.
   ============================================================ */

// Where the character currently is on the grid (null = not placed yet)
let characterPos = { col: 0, row: 0 };   // Starts at top-left hex

// The SVG <image> element for the character (we create this in placeCharacter)
let characterSprite = null;

// We need a reference to the SVG to add/move the sprite — stored here after buildGrid
let gameSVG = null;


/*
  placeCharacter(col, row)
  ────────────────────────
  Draws the character sprite on the hex at (col, row).

  If the sprite already exists, it moves it.
  If it doesn't exist yet, it creates it.

  The image is sized to fit inside the hex (HEX_SIZE controls this)
  and centred on the hex's centre point.
*/
/* ============================================================
   SPRITE ANIMATION
   ============================================================
   The spritesheet has 7 frames in a single horizontal row.
   Total size: 224×32px — so each frame is 32×32px.

   To animate we:
     1. Create a <clipPath> — a rectangular mask that only shows
        one 32×32 frame at a time
     2. Place the full <image> behind that mask
     3. Use setInterval to shift the image left every N ms,
        revealing the next frame each tick
   ============================================================ */

const FRAME_COUNT  = 7;     // Total frames in the spritesheet
const FRAME_WIDTH  = 32;    // Width of one frame in pixels
const FRAME_HEIGHT = 32;    // Height of one frame in pixels
const FRAME_SPEED  = 120;   // Milliseconds between frames (lower = faster)

// Tracks the animation interval so we can stop/restart it
let spriteInterval  = null;
let currentFrame    = 0;

/*
  startSpriteAnimation()
  ──────────────────────
  Begins cycling through the spritesheet frames.
  If an animation is already running, stops it first
  so we never have two timers running at once.
*/
function startSpriteAnimation() {
  if (spriteInterval !== null) {
    clearInterval(spriteInterval);
  }

  spriteInterval = setInterval(() => {
    currentFrame = (currentFrame + 1) % FRAME_COUNT;

    // Shift the image left by one frame width to show the next frame.
    // We use a negative x offset — moving the image left reveals the next frame
    // through the fixed clipPath window.
    if (characterSprite) {
      const center = getHexCenter(characterPos.col, characterPos.row);
      const displaySize = HEX_SIZE * 1.4;   // how big the sprite appears on the hex

      // Scale factor: our display size vs original frame size
      const scale = displaySize / FRAME_HEIGHT;
      const scaledFrameWidth = FRAME_WIDTH * scale;

      // x position: start at centre, then shift left by (frame index × scaled frame width)
      characterSprite.setAttribute('x',
        (center.x - displaySize / 2) - currentFrame * scaledFrameWidth
      );
    }
  }, FRAME_SPEED);
}


/*
  placeCharacter(col, row)
  ────────────────────────
  Draws or moves the character sprite on the hex at (col, row).
  On first call, creates the clipPath mask and image element.
  On subsequent calls, just repositions them.
*/
function placeCharacter(col, row) {
  const center      = getHexCenter(col, row);
  const displaySize = HEX_SIZE * 1.4;
  const scale       = displaySize / FRAME_HEIGHT;
  const scaledFrameWidth  = FRAME_WIDTH  * scale;
  const scaledSheetWidth  = scaledFrameWidth * FRAME_COUNT;
  const scaledFrameHeight = FRAME_HEIGHT * scale;

  if (characterSprite === null) {
    // ── First time: build the clip mask and image ──

    // 1. Create a <clipPath> — defines a rectangle that acts as a window,
    //    hiding all parts of the image outside it
    const clipPath = document.createElementNS(SVG_NS, 'clipPath');
    clipPath.setAttribute('id', 'sprite-clip');

    const clipRect = document.createElementNS(SVG_NS, 'rect');
    clipRect.setAttribute('width',  displaySize);
    clipRect.setAttribute('height', displaySize);
    // Position is set below alongside the image
    clipRect.setAttribute('x', center.x - displaySize / 2);
    clipRect.setAttribute('y', center.y - displaySize / 2);
    clipPath.appendChild(clipRect);

    // Store rect ref so we can move the clip window when character moves
    characterSprite = document.createElementNS(SVG_NS, 'image');
    characterSprite.setAttribute('href',   ASSET_CHARACTER_IMG);
    characterSprite.setAttribute('width',  scaledSheetWidth);   // full sheet width
    characterSprite.setAttribute('height', scaledFrameHeight);
    characterSprite.setAttribute('clip-path', 'url(#sprite-clip)');
    characterSprite.setAttribute('pointer-events', 'none');

    // Add clipPath definition to SVG <defs>
    let defs = gameSVG.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      gameSVG.insertBefore(defs, gameSVG.firstChild);
    }
    defs.appendChild(clipPath);
    gameSVG.appendChild(characterSprite);

    // Store the clip rect so we can move it when the character moves
    characterSprite._clipRect = clipRect;

    // Start the animation loop
    startSpriteAnimation();
  }

  // ── Every call: update position of image and clip window ──
  const x = center.x - displaySize / 2;
  const y = center.y - displaySize / 2;

  // Move the clip window to the new hex position
  characterSprite._clipRect.setAttribute('x', x);
  characterSprite._clipRect.setAttribute('y', y);

  // Move the image — offset by current frame so animation stays in sync
  characterSprite.setAttribute('x', x - currentFrame * scaledFrameWidth);
  characterSprite.setAttribute('y', y);

  characterPos = { col, row };
}

/*
  moveCharacter(col, row)
  ───────────────────────
  Moves the character to a new hex and plays the move sound.
  Called from the click handler when the player selects a destination.
*/
function moveCharacter(col, row) {
  placeCharacter(col, row);
  playSound(ASSET_SOUND_MOVE);
  updateStatus(`Monster moved to Row ${row + 1}, Col ${col + 1}`);
  updateInfoPanel(`Monster at → Row: ${row + 1}  |  Col: ${col + 1}`);
}
/* ============================================================
   SECTION 10 — HEX NEIGHBOURS
   ============================================================
   To find a path, we first need to know which hexes are
   adjacent to any given hex (its "neighbours").

   For a pointy-top offset grid, the 6 neighbours of a hex
   depend on whether the row is EVEN or ODD, because odd rows
   are shifted right by half a column.

   Even row neighbours:        Odd row neighbours:
     (-1,-1) (0,-1)              (0,-1) (+1,-1)
      (-1, 0)   (+1, 0)          (-1, 0)   (+1, 0)
     (-1,+1) (0,+1)              (0,+1) (+1,+1)
   ============================================================ */

function getNeighbours(col, row) {
  // Neighbour offsets differ based on whether this row is even or odd
  const offsets = (row % 2 === 0)
    ? [[-1,-1],[0,-1],[-1,0],[1,0],[-1,1],[0,1]]   // even row
    : [[0,-1],[1,-1],[-1,0],[1,0],[0,1],[1,1]];     // odd row

  const neighbours = [];

  for (const [dc, dr] of offsets) {
    const nc = col + dc;
    const nr = row + dr;

    // Only include neighbours that are within the grid boundaries
    if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
      neighbours.push({ col: nc, row: nr });
    }
  }

  return neighbours;
}


/* ============================================================
   SECTION 11 — PATHFINDING (BFS)
   ============================================================
   BFS = Breadth-First Search.
   It is the standard algorithm for finding the SHORTEST path
   on a grid where every step costs the same.

   HOW IT WORKS:
     Imagine dropping a stone in water — ripples spread outward
     in all directions evenly. BFS works the same way:

     1. Start at the character's position
     2. Visit all neighbours (1 step away)
     3. Then visit their neighbours (2 steps away)
     4. Keep going until we reach the target hex

     Because we always expand the closest hexes first, the
     FIRST time we reach the target is guaranteed to be via
     the shortest path.

   THE "VISITED" MAP:
     We use a Map to track two things for each visited hex:
       - That we've already been there (so we don't revisit)
       - Which hex we came FROM (so we can trace the path back)

   TRACING BACK:
     Once we reach the target, we follow the "came from" chain
     backwards from target → start to reconstruct the path.
     Then we reverse it so it goes start → target.
   ============================================================ */

function findPath(startCol, startRow, endCol, endRow) {
  // A "queue" is a list we add to the back and take from the front (FIFO).
  // BFS uses a queue to process hexes in order of distance.
  const queue = [{ col: startCol, row: startRow }];

  // cameFrom maps "col,row" → the hex we came from to reach it
  // This lets us reconstruct the path at the end
  const cameFrom = new Map();

  // Mark the start as visited (it has no "came from")
  const startKey = `${startCol},${startRow}`;
  cameFrom.set(startKey, null);

  // Keep going until the queue is empty (all reachable hexes visited)
  while (queue.length > 0) {

    // Take the next hex from the FRONT of the queue
    const current = queue.shift();
    const { col, row } = current;

    // Have we reached the target?
    if (col === endCol && row === endRow) {
      // Reconstruct the path by following cameFrom backwards
      return reconstructPath(cameFrom, startCol, startRow, endCol, endRow);
    }

    // Visit each neighbour of the current hex
    for (const neighbour of getNeighbours(col, row)) {
      const key = `${neighbour.col},${neighbour.row}`;

      // Only visit hexes we haven't been to yet
      if (!cameFrom.has(key)) {
        cameFrom.set(key, { col, row });  // Record where we came from
        queue.push(neighbour);            // Add to queue to explore later
      }
    }
  }

  // If we exit the loop without finding the target, no path exists
  return [];
}


/*
  reconstructPath(cameFrom, startCol, startRow, endCol, endRow)
  ─────────────────────────────────────────────────────────────
  Traces the cameFrom chain from end back to start,
  building the list of hexes in the path.
  Then reverses it so it runs start → end.
*/
function reconstructPath(cameFrom, startCol, startRow, endCol, endRow) {
  const path = [];
  let current = { col: endCol, row: endRow };

  // Walk backwards through cameFrom until we reach the start
  while (current !== null) {
    path.push(current);
    const key = `${current.col},${current.row}`;
    current = cameFrom.get(key);  // Move to the hex we came from
  }

  // Path is currently end→start, reverse it to get start→end
  path.reverse();

  // Remove the first step (that's the character's current position)
  path.shift();

  return path;
}


/* ============================================================
   SECTION 12 — PATH ANIMATION
   ============================================================
   Once we have a path (an array of hex positions), we move
   the character one step at a time with a delay between steps.

   setInterval() calls a function repeatedly every N milliseconds.
   We use it to move the character one hex per interval tick.
   When the character reaches the end, we clearInterval() to stop.

   We also highlight the planned path so the player can see it.
   ============================================================ */

// Tracks the highlighted path polygons so we can un-highlight them
let pathHighlightedHexes = [];

// The speed of movement — milliseconds between each step
const MOVE_SPEED_MS = 220;


/*
  highlightPath(path)
  ───────────────────
  Adds the CSS class "on-path" to each hex in the planned route
  so the player can see where the character is going.
*/
function highlightPath(path) {
  clearPathHighlight();   // Remove any previous path highlight

  for (const step of path) {
    // Find the polygon for this grid position using its data attributes
    const poly = document.querySelector(
      `.hex[data-col="${step.col}"][data-row="${step.row}"]`
    );
    if (poly) {
      poly.classList.add('on-path');
      pathHighlightedHexes.push(poly);
    }
  }
}


/*
  clearPathHighlight()
  ────────────────────
  Removes the "on-path" highlight from all previously highlighted hexes.
*/
function clearPathHighlight() {
  for (const poly of pathHighlightedHexes) {
    poly.classList.remove('on-path');
  }
  pathHighlightedHexes = [];
}


/*
  animateAlongPath(path)
  ──────────────────────
  Moves the character one hex at a time along the given path.

  Uses setInterval to create a repeating timer.
  Each tick moves the character one step forward.
  When the path is exhausted, the interval is cleared (stopped).
*/
function animateAlongPath(path) {
  if (path.length === 0) return;

  clearSelection();
  highlightPath(path);

  let stepIndex = 0;

  const interval = setInterval(() => {
  const step = path[stepIndex];

  if (!gameActive) {
    gameActive = true;
    startTimer();
  }

  placeCharacter(step.col, step.row);

  checkCrystalCollection(step.col, step.row); // ← must be HERE, runs every step

  const tileIndex = TILE_MAP[step.row][step.col];
  playSound(TILE_TYPES[tileIndex].sound);

  const poly = document.querySelector(
    `.hex[data-col="${step.col}"][data-row="${step.row}"]`
  );
  if (poly) poly.classList.remove('on-path');

  stepIndex++;   // ← checkCrystalCollection must be BEFORE this line

  if (stepIndex >= path.length) {
    clearInterval(interval);
    clearPathHighlight();
    updateStatus(`Monster at Row ${step.row + 1}, Col ${step.col + 1}`);
    updateInfoPanel(`Monster at → Row: ${step.row + 1}  |  Col: ${step.col + 1}`);
  }

}, MOVE_SPEED_MS);
}
/* ============================================================
   SECTION 13 — SCORE, TIMER & WIN/LOSE CONDITION
   ============================================================
   SCORE:
     We use a Set to track collected crystals.
     A Set is like an array but automatically ignores duplicates —
     perfect for "has this tile been collected?" tracking.
     Each entry is a string "col,row" (e.g. "2,1").

   TIMER:
     We count DOWN from TIMER_SECONDS using setInterval.
     Every second we subtract 1 and update the display.
     If it hits 0 → game over. If all crystals collected → you win.

   WIN/LOSE:
     Both screens are divs with class "hidden" in HTML.
     Removing the "hidden" class makes them visible.
     The "Play Again" button calls restartGame() which reloads the page.
   ============================================================ */

const TIMER_SECONDS  = 15;     // Total seconds the player has
let timeRemaining    = TIMER_SECONDS;
let timerInterval    = null;    // Reference to the countdown interval
let gameActive       = false;   // Becomes true on first move; freezes on win/lose

// Tracks which crystal tiles have been collected — stores "col,row" strings
const collectedCrystals = new Set();

// Count total crystals on the board (calculated once from TILE_MAP)
let totalCrystals = 0;
for (let r = 0; r < GRID_ROWS; r++) {
  for (let c = 0; c < GRID_COLS; c++) {
    if (TILE_MAP[r][c] === 2) totalCrystals++;
  }
}


/*
  startTimer()
  ────────────
  Begins the countdown. Called on the player's first move.
  Uses setInterval to fire every 1000ms (1 second).
*/
function startTimer() {
  // Don't start a second timer if one is already running
  if (timerInterval !== null) return;

  timerInterval = setInterval(() => {
    timeRemaining--;

    // Update the timer display
    const timerEl = document.getElementById('timer');
    timerEl.textContent = `⏱ ${timeRemaining}s`;

    // Turn timer red when 5 seconds or fewer remain
    if (timeRemaining <= 5) {
      timerEl.classList.add('urgent');
    }

    // Time's up → game over
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      triggerGameOver();
    }
  }, 1000);
}


/*
  updateScoreDisplay()
  ────────────────────
  Refreshes the crystal counter in the stats bar.
*/
function updateScoreDisplay() {
  document.getElementById('crystal-count').textContent =
    `${collectedCrystals.size} / ${totalCrystals}`;
}


/*
  checkCrystalCollection(col, row)
  ────────────────────────────────
  Called every time the character steps onto a hex.
  If that hex is a crystal tile and hasn't been collected yet:
    - Adds it to the collectedCrystals Set
    - Dims the tile image visually
    - Updates the score display
    - Checks if all crystals are collected (win condition)
*/
function checkCrystalCollection(col, row) {
  // Is this hex a crystal tile? (TILE_MAP index 2 = crystal)
  if (TILE_MAP[row][col] !== 2) return;

  const key = `${col},${row}`;

  // Already collected? Do nothing
  if (collectedCrystals.has(key)) return;

  // Collect it!
  collectedCrystals.add(key);
  updateScoreDisplay();
  playSound(TILE_TYPES[2].sound);   // Play crystal sound on collection

  // Visually dim the tile image to show it's been collected.
  // We find the <image> element by checking the SVG for the tile
  // at this position — tile images are placed before polygons, so
  // we use a data attribute on the image to find it.
  const tileImg = document.querySelector(
    `image[data-tile-col="${col}"][data-tile-row="${row}"]`
  );
  if (tileImg) tileImg.classList.add('tile-collected');

  updateStatus(`💎 Crystal collected! ${collectedCrystals.size}/${totalCrystals}`);

  // Check win condition
  if (collectedCrystals.size >= totalCrystals) {
    triggerWin();
  }
}


/*
  triggerWin()
  ────────────
  Stops the timer and shows the win screen.
*/
function triggerWin() {
  clearInterval(timerInterval);
  timerInterval = null;
  gameActive = false;

  const timeTaken = TIMER_SECONDS - timeRemaining;

  document.getElementById('win-time').textContent =
    `⏱ Time: ${timeTaken} seconds`;

  // ✅ img tag instead of emoji
  document.getElementById('win-score').innerHTML =
    `<img src="Assets/0001s-0023-Layer-0-copy-23.png" style="width:24px;vertical-align:middle;margin-right:6px;">Crystals: ${collectedCrystals.size} / ${totalCrystals}`;

  document.getElementById('win-screen').classList.remove('hidden');
}

function triggerGameOver() {
  gameActive = false;

  // ✅ img tag instead of emoji
  document.getElementById('gameover-score').innerHTML =
    `<img src="Assets/0001s-0023-Layer-0-copy-23.png" style="width:24px;vertical-align:middle;margin-right:6px;">Crystals collected: ${collectedCrystals.size} / ${totalCrystals}`;

  document.getElementById('gameover-screen').classList.remove('hidden');
}
function restartGame() {
  location.reload();
}
function setFaviconFromFirstFrame() {
  const canvas  = document.createElement('canvas');
  canvas.width  = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  const sheet = new Image();

  let favicon = document.querySelector("link[rel='icon']");
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }

  sheet.onload = () => {
    // Draw only the first frame (frame 0 — x offset = 0)
    ctx.drawImage(
      sheet,
      0, 0, 32, 32,   // source: first 32×32 pixels of the sheet
      0, 0, 32, 32    // destination: full canvas
    );
    favicon.href = canvas.toDataURL('image/png');
  };

  sheet.src = 'Assets/Blue Idle - no slime.png';
}
