"use strict";


/*
============================================================
MANUAL TESTER HIGHLIGHTER
CONTENT SCRIPT
============================================================

FEATURES
--------

1. Draw rectangle around webpage component.

2. Store component using:

       ID
       CSS Selector
       XPath

3. Three highlight colors:

       Red
       Green
       Blue

4. Optional hover message for every highlight.

5. Highlight follows the real DOM element.

6. Highlights survive:

       Scroll
       Resize
       DOM changes
       Logout/Login
       Page refresh

7. Hover message:

       Appears when mouse enters
       Disappears when mouse leaves

8. Individual highlight deletion:

       Double click
       OR
       Right click -> Delete Highlight

9. Clear all highlights.

10. Everything is stored locally using:

       chrome.storage.local

11. No coordinates are stored.

============================================================
*/


/*
============================================================
STATE
============================================================
*/

let enabled = false;

let selectedColor = "red";

let selectorType = SELECTOR_TYPES.ID;

let highlights = [];


let layer = null;

let drawingElement = null;

let isDrawing = false;

let startX = 0;

let startY = 0;


let renderScheduled = false;

let mutationObserver = null;


/*
============================================================
ACTIVE TOOLTIP
============================================================
*/

let activeTooltip = null;

let activeHighlightId = null;


/*
============================================================
CUSTOM CONTEXT MENU
============================================================
*/

let contextMenu = null;

let contextMenuHighlightId = null;


/*
============================================================
VALID COLORS
============================================================
*/

const VALID_COLORS =
    new Set([
        "red",
        "green",
        "blue"
    ]);


/*
============================================================
VALID SELECTOR TYPES
============================================================
*/

const VALID_SELECTOR_TYPES =
    new Set([
        "id",
        "css",
        "xpath"
    ]);


/*
============================================================
PAGE KEY
============================================================

Highlights are stored against the website origin.

Example:

    https://example.com

This means:

    /login
    /dashboard
    /profile

can use the same stored highlight collection
for that website.

============================================================
*/

function getPageKey() {

    return window.location.origin;

}


/*
============================================================
CHECK EXTENSION ELEMENT
============================================================
*/

function isExtensionElement(
    element
) {

    if (
        !(element instanceof Element)
    ) {

        return false;

    }


    return Boolean(

        element.closest(

            "#manual-tester-highlighter-layer, " +

            ".manual-tester-tooltip, " +

            ".manual-tester-context-menu"

        )

    );

}


/*
============================================================
CHECK EXTENSION MUTATION
============================================================
*/

function isExtensionMutation(
    mutation
) {

    if (

        mutation.target instanceof Element &&

        isExtensionElement(
            mutation.target
        )

    ) {

        return true;

    }


    for (
        const node
        of mutation.addedNodes
    ) {

        if (

            node instanceof Element &&

            isExtensionElement(
                node
            )

        ) {

            return true;

        }

    }


    for (
        const node
        of mutation.removedNodes
    ) {

        if (

            node instanceof Element &&

            isExtensionElement(
                node
            )

        ) {

            return true;

        }

    }


    return false;

}


/*
============================================================
CREATE HIGHLIGHT LAYER
============================================================
*/

function createLayer() {

    if (layer) {

        return;

    }


    layer =
        document.createElement(
            "div"
        );


    layer.id =
        "manual-tester-highlighter-layer";


    document.documentElement.appendChild(
        layer
    );

}


/*
============================================================
REMOVE ACTIVE TOOLTIP
============================================================
*/

function removeActiveTooltip() {

    if (!activeTooltip) {

        activeHighlightId = null;

        return;

    }


    if (
        typeof activeTooltip._cleanup ===
        "function"
    ) {

        activeTooltip._cleanup();

    } else if (
        activeTooltip.isConnected
    ) {

        activeTooltip.remove();

    }


    activeTooltip = null;

    activeHighlightId = null;

}


/*
============================================================
REMOVE ALL TOOLTIPS
============================================================
*/

function removeAllTooltips() {

    removeActiveTooltip();


    const tooltips =
        document.querySelectorAll(
            ".manual-tester-tooltip"
        );


    tooltips.forEach(
        tooltip => {

            if (
                typeof tooltip._cleanup ===
                "function"
            ) {

                tooltip._cleanup();

            } else {

                tooltip.remove();

            }

        }
    );

}


/*
============================================================
REMOVE CONTEXT MENU
============================================================
*/

function removeContextMenu() {

    if (!contextMenu) {

        contextMenuHighlightId = null;

        return;

    }


    contextMenu.remove();

    contextMenu = null;

    contextMenuHighlightId = null;

}


/*
============================================================
REMOVE HIGHLIGHT LAYER
============================================================
*/

function removeLayer() {

    removeActiveTooltip();

    removeContextMenu();


    if (!layer) {

        return;

    }


    layer.remove();

    layer = null;

}


/*
============================================================
LOAD SETTINGS
============================================================
*/

async function loadSettings() {

    const result =
        await chrome.storage.local.get([

            "enabled",

            "selectedColor",

            "selectorType"

        ]);


    enabled =
        Boolean(
            result.enabled
        );


    selectedColor =
        VALID_COLORS.has(
            result.selectedColor
        )
            ? result.selectedColor
            : "red";


    selectorType =
        VALID_SELECTOR_TYPES.has(
            result.selectorType
        )
            ? result.selectorType
            : SELECTOR_TYPES.ID;

}


/*
============================================================
NORMALIZE HIGHLIGHTS
============================================================
*/

function normalizeHighlights(
    items
) {

    if (
        !Array.isArray(items)
    ) {

        return [];

    }


    return items

        .filter(
            item =>

                item &&

                typeof item ===
                "object"

        )

        .map(
            item => ({

                ...item,

                message:

                    typeof item.message ===
                    "string"

                        ? item.message

                        : ""

            })

        );

}


/*
============================================================
LOAD HIGHLIGHTS
============================================================
*/

async function loadHighlights() {

    const result =
        await chrome.storage.local.get([

            "highlights"

        ]);


    const allHighlights =
        result.highlights || {};


    const originKey =
        getPageKey();


    /*
    ========================================================
    CURRENT STORAGE FORMAT
    ========================================================
    */

    if (
        Array.isArray(
            allHighlights[originKey]
        )
    ) {

        highlights =
            normalizeHighlights(
                allHighlights[originKey]
            );

        return;

    }


    /*
    ========================================================
    OLD STORAGE FORMAT MIGRATION
    ========================================================

    Older version stored:

        origin + pathname + search

    Convert it to:

        origin

    ========================================================
    */

    const oldKey =

        window.location.origin +

        window.location.pathname +

        window.location.search;


    if (
        Array.isArray(
            allHighlights[oldKey]
        )
    ) {

        highlights =
            normalizeHighlights(
                allHighlights[oldKey]
            );


        allHighlights[originKey] =
            highlights;


        delete allHighlights[oldKey];


        await chrome.storage.local.set({

            highlights:
                allHighlights

        });


        return;

    }


    highlights = [];

}


/*
============================================================
SAVE HIGHLIGHTS
============================================================
*/

async function saveHighlights() {

    const result =
        await chrome.storage.local.get([

            "highlights"

        ]);


    const allHighlights =
        result.highlights || {};


    allHighlights[
        getPageKey()
    ] =
        highlights;


    await chrome.storage.local.set({

        highlights:
            allHighlights

    });

}


/*
============================================================
GENERATE UNIQUE HIGHLIGHT ID
============================================================
*/

function generateId() {

    return (

        "highlight_" +

        Date.now() +

        "_" +

        Math.random()
            .toString(36)
            .slice(2, 10)

    );

}


/*
============================================================
GET HIGHLIGHT COLOR
============================================================
*/

function getColor(
    color
) {

    const colors = {

        red:
            "#ff3b30",

        green:
            "#34c759",

        blue:
            "#007aff"

    };


    return (

        colors[color] ||

        colors.red

    );

}


/*
============================================================
GET ELEMENT RECTANGLE
============================================================
*/

function getElementRectangle(
    element
) {

    if (
        !(element instanceof Element)
    ) {

        return null;

    }


    const rect =
        element.getBoundingClientRect();


    if (

        rect.width <= 0 ||

        rect.height <= 0

    ) {

        return null;

    }


    return {

        left:
            rect.left,

        top:
            rect.top,

        width:
            rect.width,

        height:
            rect.height

    };

}


/*
============================================================
DELETE SINGLE HIGHLIGHT
============================================================
*/

async function deleteHighlight(
    highlightId
) {

    /*
    Remove tooltip immediately.
    */

    if (
        activeHighlightId ===
        highlightId
    ) {

        removeActiveTooltip();

    }


    /*
    Remove context menu.
    */

    if (
        contextMenuHighlightId ===
        highlightId
    ) {

        removeContextMenu();

    }


    /*
    Remove highlight from memory.
    */

    const oldLength =
        highlights.length;


    highlights =
        highlights.filter(

            item =>
                item.id !==
                highlightId

        );


    /*
    Nothing was removed.
    */

    if (
        highlights.length ===
        oldLength
    ) {

        return;

    }


    /*
    Save immediately.
    */

    await saveHighlights();


    /*
    Re-render.
    */

    renderHighlights();

}


/*
============================================================
CREATE TOOLTIP
============================================================
*/

function createTooltip(
    visual,
    highlight
) {

    if (

        !highlight ||

        typeof highlight.message !==
        "string" ||

        highlight.message.trim() === ""

    ) {

        return null;

    }


    const tooltip =
        document.createElement(
            "div"
        );


    tooltip.className =
        "manual-tester-tooltip";


    tooltip.dataset.owner =
        highlight.id;


    tooltip.textContent =
        highlight.message;


    document.body.appendChild(
        tooltip
    );


    /*
    ========================================================
    POSITION TOOLTIP
    ========================================================
    */

    function positionTooltip() {

        if (

            !visual ||

            !visual.isConnected ||

            !tooltip.isConnected

        ) {

            return;

        }


        const rectangle =
            visual.getBoundingClientRect();


        const tooltipRectangle =
            tooltip.getBoundingClientRect();


        let left =

            rectangle.left +

            (

                rectangle.width -

                tooltipRectangle.width

            ) / 2;


        let top =

            rectangle.bottom +

            10;


        const padding =
            10;


        /*
        Prevent right overflow.
        */

        if (

            left +

            tooltipRectangle.width +

            padding >

            window.innerWidth

        ) {

            left =

                window.innerWidth -

                tooltipRectangle.width -

                padding;

        }


        /*
        Prevent left overflow.
        */

        if (
            left < padding
        ) {

            left =
                padding;

        }


        /*
        Put tooltip above when
        there is not enough space below.
        */

        if (

            top +

            tooltipRectangle.height +

            padding >

            window.innerHeight

        ) {

            top =

                rectangle.top -

                tooltipRectangle.height -

                10;

        }


        /*
        Prevent top overflow.
        */

        if (
            top < padding
        ) {

            top =
                padding;

        }


        tooltip.style.left =
            `${left}px`;


        tooltip.style.top =
            `${top}px`;

    }


    /*
    Position immediately.
    */

    positionTooltip();


    /*
    ========================================================
    REPOSITION LISTENERS
    ========================================================
    */

    const reposition =
        () => {

            positionTooltip();

        };


    window.addEventListener(

        "scroll",

        reposition,

        true

    );


    window.addEventListener(

        "resize",

        reposition

    );


    /*
    ========================================================
    CLEANUP
    ========================================================
    */

    tooltip._cleanup =
        () => {

            window.removeEventListener(

                "scroll",

                reposition,

                true

            );


            window.removeEventListener(

                "resize",

                reposition

            );


            if (
                tooltip.isConnected
            ) {

                tooltip.remove();

            }

        };


    return tooltip;

}


/*
============================================================
SHOW TOOLTIP
============================================================
*/

function showTooltip(
    visual,
    highlight
) {

    /*
    Tooltip is already active for this
    exact highlight.
    */

    if (

        activeTooltip &&

        activeHighlightId ===
        highlight.id

    ) {

        return;

    }


    /*
    Remove tooltip from another highlight.
    */

    removeActiveTooltip();


    /*
    Create tooltip.
    */

    const tooltip =
        createTooltip(

            visual,

            highlight

        );


    if (!tooltip) {

        return;

    }


    activeTooltip =
        tooltip;


    activeHighlightId =
        highlight.id;

}


/*
============================================================
CREATE VISUAL HIGHLIGHT
============================================================
*/

function createHighlightElement(
    highlight,
    element
) {

    if (!layer) {

        return null;

    }


    const rectangle =
        getElementRectangle(
            element
        );


    if (!rectangle) {

        return null;

    }


    const visual =
        document.createElement(
            "div"
        );


    visual.className =

        "manual-tester-highlight " +

        highlight.color;


    visual.dataset.id =
        highlight.id;


    visual.dataset.selectorType =
        highlight.selectorType;


    visual.dataset.selector =
        highlight.selector;


    /*
    ========================================================
    POSITION
    ========================================================
    */

    visual.style.left =
        `${rectangle.left}px`;


    visual.style.top =
        `${rectangle.top}px`;


    visual.style.width =
        `${rectangle.width}px`;


    visual.style.height =
        `${rectangle.height}px`;


    /*
    ========================================================
    MOUSE ENTER
    ========================================================
    */

    visual.addEventListener(

        "mouseenter",

        () => {

            if (!enabled) {

                return;

            }


            showTooltip(

                visual,

                highlight

            );

        }

    );


    /*
    ========================================================
    MOUSE LEAVE
    ========================================================
    */

    visual.addEventListener(

        "mouseleave",

        () => {

            if (

                activeHighlightId ===
                highlight.id

            ) {

                removeActiveTooltip();

            }

        }

    );


    /*
    ========================================================
    DOUBLE CLICK DELETE
    ========================================================
    */

    visual.addEventListener(

        "dblclick",

        async event => {

            event.preventDefault();

            event.stopPropagation();


            await deleteHighlight(

                highlight.id

            );

        }

    );


    /*
    ========================================================
    RIGHT CLICK
    ========================================================
    */

    visual.addEventListener(

        "contextmenu",

        event => {

            event.preventDefault();

            event.stopPropagation();


            showContextMenu(

                event.clientX,

                event.clientY,

                highlight

            );

        }

    );


    /*
    ========================================================
    ACCESSIBILITY
    ========================================================
    */

    visual.setAttribute(

        "aria-label",

        highlight.message

            ? highlight.message

            : `${highlight.selectorType.toUpperCase()}: ${highlight.selector}`

    );


    layer.appendChild(
        visual
    );


    return visual;

}


/*
============================================================
RENDER HIGHLIGHTS
============================================================

IMPORTANT:

We only remove the visual rectangles.

The tooltip is managed separately.

This prevents tooltip blinking.

============================================================
*/

function renderHighlights() {

    if (!enabled) {

        removeLayer();

        return;

    }


    createLayer();


    /*
    Remove only old visual rectangles.

    DO NOT remove tooltip here.
    */

    const existingVisuals =
        layer.querySelectorAll(

            ".manual-tester-highlight, " +

            ".manual-tester-drawing"

        );


    existingVisuals.forEach(

        visual => {

            visual.remove();

        }

    );


    /*
    ========================================================
    CREATE CURRENT HIGHLIGHTS
    ========================================================
    */

    for (
        const highlight
        of highlights
    ) {

        if (!highlight) {

            continue;

        }


        if (
            !VALID_COLORS.has(
                highlight.color
            )
        ) {

            continue;

        }


        if (
            !VALID_SELECTOR_TYPES.has(
                highlight.selectorType
            )
        ) {

            continue;

        }


        if (

            typeof highlight.selector !==
            "string"

        ) {

            continue;

        }


        const element =
            resolveSelector(

                highlight.selectorType,

                highlight.selector

            );


        if (!element) {

            continue;

        }


        createHighlightElement(

            highlight,

            element

        );

    }

}


/*
============================================================
SCHEDULE RENDER
============================================================
*/

function scheduleRender() {

    if (

        !enabled ||

        renderScheduled

    ) {

        return;

    }


    renderScheduled = true;


    window.requestAnimationFrame(

        () => {

            renderScheduled = false;

            renderHighlights();

        }

    );

}


/*
============================================================
NORMALIZE DRAWING RECTANGLE
============================================================
*/

function normalizeRectangle(
    x1,
    y1,
    x2,
    y2
) {

    return {

        left:
            Math.min(
                x1,
                x2
            ),

        right:
            Math.max(
                x1,
                x2
            ),

        top:
            Math.min(
                y1,
                y2
            ),

        bottom:
            Math.max(
                y1,
                y2
            ),

        width:
            Math.abs(
                x2 - x1
            ),

        height:
            Math.abs(
                y2 - y1
            )

    };

}


/*
============================================================
RECTANGLE INTERSECTION
============================================================
*/

function rectanglesIntersect(
    a,
    b
) {

    return (

        a.left < b.right &&

        a.right > b.left &&

        a.top < b.bottom &&

        a.bottom > b.top

    );

}


/*
============================================================
ELEMENT AREA
============================================================
*/

function getElementArea(
    element
) {

    const rect =
        element.getBoundingClientRect();


    return (

        Math.max(
            0,
            rect.width
        ) *

        Math.max(
            0,
            rect.height
        )

    );

}


/*
============================================================
IGNORE ELEMENT
============================================================
*/

function isIgnoredElement(
    element
) {

    if (
        !(element instanceof Element)
    ) {

        return true;

    }


    if (
        isExtensionElement(
            element
        )
    ) {

        return true;

    }


    const tag =
        element.tagName.toLowerCase();


    return [

        "html",

        "body",

        "script",

        "style",

        "link",

        "meta",

        "noscript",

        "svg",

        "path"

    ].includes(tag);

}


/*
============================================================
GET ELEMENTS INSIDE DRAWING AREA
============================================================
*/

function getElementsInRectangle(
    rectangle
) {

    const elements =
        document.querySelectorAll(
            "body *"
        );


    const candidates = [];


    for (
        const element
        of elements
    ) {

        if (
            isIgnoredElement(
                element
            )
        ) {

            continue;

        }


        const rect =
            element.getBoundingClientRect();


        if (

            rect.width <= 0 ||

            rect.height <= 0

        ) {

            continue;

        }


        const elementRectangle = {

            left:
                rect.left,

            right:
                rect.right,

            top:
                rect.top,

            bottom:
                rect.bottom

        };


        if (
            rectanglesIntersect(

                rectangle,

                elementRectangle

            )
        ) {

            candidates.push(
                element
            );

        }

    }


    return candidates;

}


/*
============================================================
SELECT BEST ELEMENT
============================================================
*/

function getBestElement(
    rectangle
) {

    const candidates =
        getElementsInRectangle(
            rectangle
        );


    if (
        candidates.length === 0
    ) {

        return null;

    }


    const centerX =

        rectangle.left +

        rectangle.width / 2;


    const centerY =

        rectangle.top +

        rectangle.height / 2;


    /*
    Prefer elements containing
    the center of drawing rectangle.
    */

    const centerCandidates =
        candidates.filter(

            element => {

                const rect =
                    element.getBoundingClientRect();


                return (

                    centerX >= rect.left &&

                    centerX <= rect.right &&

                    centerY >= rect.top &&

                    centerY <= rect.bottom

                );

            }

        );


    const pool =

        centerCandidates.length > 0

            ? centerCandidates

            : candidates;


    /*
    Prefer meaningful webpage components.
    */

    const priority = {

        button: 100,

        input: 100,

        select: 100,

        textarea: 100,

        a: 90,

        label: 80,

        option: 70,

        img: 60,

        form: 50,

        nav: 40,

        section: 30,

        article: 30,

        main: 20,

        div: 10,

        span: 10

    };


    pool.sort(

        (a, b) => {

            const tagA =
                a.tagName.toLowerCase();


            const tagB =
                b.tagName.toLowerCase();


            const priorityA =
                priority[tagA] || 0;


            const priorityB =
                priority[tagB] || 0;


            if (
                priorityA !==
                priorityB
            ) {

                return (

                    priorityB -

                    priorityA

                );

            }


            /*
            If same priority,
            prefer smaller element.
            */

            return (

                getElementArea(a) -

                getElementArea(b)

            );

        }

    );


    return pool[0];

}


/*
============================================================
START DRAWING
============================================================
*/

function beginDrawing(
    event
) {

    if (!enabled) {

        return;

    }


    if (isDrawing) {

        return;

    }


    if (
        event.button !== 0
    ) {

        return;

    }


    /*
    Do not draw on an existing highlight.
    */

    if (

        event.target instanceof Element &&

        event.target.closest(

            ".manual-tester-highlight"

        )

    ) {

        return;

    }


    isDrawing = true;


    startX =
        event.clientX;


    startY =
        event.clientY;


    createLayer();


    drawingElement =
        document.createElement(
            "div"
        );


    drawingElement.className =
        "manual-tester-drawing";


    drawingElement.style.borderColor =
        getColor(
            selectedColor
        );


    layer.appendChild(
        drawingElement
    );


    updateDrawing(

        event.clientX,

        event.clientY

    );


    event.preventDefault();

}


/*
============================================================
UPDATE DRAWING
============================================================
*/

function updateDrawing(
    clientX,
    clientY
) {

    if (

        !isDrawing ||

        !drawingElement

    ) {

        return;

    }


    const rectangle =
        normalizeRectangle(

            startX,

            startY,

            clientX,

            clientY

        );


    drawingElement.style.left =
        `${rectangle.left}px`;


    drawingElement.style.top =
        `${rectangle.top}px`;


    drawingElement.style.width =
        `${rectangle.width}px`;


    drawingElement.style.height =
        `${rectangle.height}px`;

}


/*
============================================================
FINISH DRAWING
============================================================
*/

async function finishDrawing(
    event
) {

    if (!isDrawing) {

        return;

    }


    const rectangle =
        normalizeRectangle(

            startX,

            startY,

            event.clientX,

            event.clientY

        );


    if (drawingElement) {

        drawingElement.remove();

        drawingElement = null;

    }


    isDrawing = false;


    /*
    Ignore tiny selections.
    */

    if (

        rectangle.width < 5 ||

        rectangle.height < 5

    ) {

        scheduleRender();

        return;

    }


    /*
    Find webpage component.
    */

    const element =
        getBestElement(
            rectangle
        );


    if (!element) {

        window.alert(

            "No webpage component was detected inside the selected area."

        );


        scheduleRender();

        return;

    }


    /*
    Generate selector.
    */

    const selector =
        getSelectorForElement(

            element,

            selectorType

        );


    if (!selector) {

        window.alert(

            `Unable to create a unique ` +

            `${selectorType.toUpperCase()} ` +

            `selector for this component.\n\n` +

            (

                selectorType === "id"

                    ? "The component does not have a unique ID. Try CSS or XPath."

                    : "Try selecting a more specific component."

            )

        );


        scheduleRender();

        return;

    }


    /*
    Prevent duplicate selector.
    */

    const duplicate =
        highlights.some(

            item =>

                item.selectorType ===
                selectorType &&

                item.selector ===
                selector

        );


    if (duplicate) {

        window.alert(

            "This component is already highlighted."

        );


        scheduleRender();

        return;

    }


    /*
    Ask for optional message.
    */

    const message =
        window.prompt(

            "Enter a message for this highlight (optional):",

            ""

        );


    /*
    If user presses Cancel,
    simply save without a message.

    The highlight itself is NOT cancelled.
    */

    const finalMessage =

        message === null

            ? ""

            : message.trim();


    /*
    Create highlight object.

    IMPORTANT:

    No coordinates are stored.

    ========================================================

    Stored:

        id
        selectorType
        selector
        color
        message
        createdAt

    ========================================================
    */

    const highlight = {

        id:
            generateId(),

        selectorType:
            selectorType,

        selector:
            selector,

        color:
            selectedColor,

        message:
            finalMessage,

        createdAt:
            new Date().toISOString()

    };


    highlights.push(
        highlight
    );


    await saveHighlights();


    renderHighlights();

}


/*
============================================================
POINTER DOWN
============================================================
*/

document.addEventListener(

    "pointerdown",

    beginDrawing,

    true

);


/*
============================================================
POINTER MOVE
============================================================
*/

document.addEventListener(

    "pointermove",

    event => {

        if (!isDrawing) {

            return;

        }


        updateDrawing(

            event.clientX,

            event.clientY

        );


        event.preventDefault();

    },

    true

);


/*
============================================================
POINTER UP
============================================================
*/

document.addEventListener(

    "pointerup",

    async event => {

        if (!isDrawing) {

            return;

        }


        event.preventDefault();


        await finishDrawing(
            event
        );

    },

    true

);


/*
============================================================
POINTER CANCEL
============================================================
*/

document.addEventListener(

    "pointercancel",

    () => {

        cancelDrawing();

    },

    true

);


/*
============================================================
ESCAPE
============================================================
*/

document.addEventListener(

    "keydown",

    event => {

        if (

            event.key === "Escape" &&

            isDrawing

        ) {

            cancelDrawing();

        }

    },

    true

);


/*
============================================================
CANCEL DRAWING
============================================================
*/

function cancelDrawing() {

    if (drawingElement) {

        drawingElement.remove();

        drawingElement = null;

    }


    isDrawing = false;


    renderHighlights();

}


/*
============================================================
SCROLL
============================================================
*/

window.addEventListener(

    "scroll",

    scheduleRender,

    {
        passive: true
    }

);


/*
============================================================
RESIZE
============================================================
*/

window.addEventListener(

    "resize",

    scheduleRender,

    {
        passive: true
    }

);


/*
============================================================
CUSTOM CONTEXT MENU
============================================================
*/

function showContextMenu(
    x,
    y,
    highlight
) {

    /*
    Remove existing context menu.
    */

    removeContextMenu();


    contextMenuHighlightId =
        highlight.id;


    contextMenu =
        document.createElement(
            "div"
        );


    contextMenu.className =
        "manual-tester-context-menu";


    /*
    ========================================================
    DELETE BUTTON
    ========================================================
    */

    const deleteButton =
        document.createElement(
            "button"
        );


    deleteButton.type =
        "button";


    deleteButton.className =
        "manual-tester-context-menu-item delete";


    deleteButton.textContent =
        "Delete Highlight";


    deleteButton.addEventListener(

        "click",

        async event => {

            event.preventDefault();

            event.stopPropagation();


            const id =
                contextMenuHighlightId;


            removeContextMenu();


            if (id) {

                await deleteHighlight(
                    id
                );

            }

        }

    );


    /*
    ========================================================
    SELECTOR INFORMATION
    ========================================================
    */

    const selectorInfo =
        document.createElement(
            "div"
        );


    selectorInfo.className =
        "manual-tester-context-menu-selector";


    selectorInfo.textContent =

        `${highlight.selectorType.toUpperCase()}: ` +

        highlight.selector;


    /*
    ========================================================
    ADD MENU ITEMS
    ========================================================
    */

    contextMenu.appendChild(
        deleteButton
    );


    contextMenu.appendChild(
        selectorInfo
    );


    document.body.appendChild(
        contextMenu
    );


    /*
    ========================================================
    POSITION MENU
    ========================================================
    */

    const menuRect =
        contextMenu.getBoundingClientRect();


    let left =
        x;


    let top =
        y;


    const padding =
        8;


    /*
    Prevent right overflow.
    */

    if (

        left +

        menuRect.width >

        window.innerWidth -

        padding

    ) {

        left =

            window.innerWidth -

            menuRect.width -

            padding;

    }


    /*
    Prevent bottom overflow.
    */

    if (

        top +

        menuRect.height >

        window.innerHeight -

        padding

    ) {

        top =

            window.innerHeight -

            menuRect.height -

            padding;

    }


    /*
    Prevent left overflow.
    */

    if (
        left < padding
    ) {

        left =
            padding;

    }


    /*
    Prevent top overflow.
    */

    if (
        top < padding
    ) {

        top =
            padding;

    }


    contextMenu.style.left =
        `${left}px`;


    contextMenu.style.top =
        `${top}px`;

}


/*
============================================================
DOCUMENT CLICK
============================================================
*/

document.addEventListener(

    "click",

    event => {

        if (!contextMenu) {

            return;

        }


        if (

            event.target instanceof Element &&

            event.target.closest(

                ".manual-tester-context-menu"

            )

        ) {

            return;

        }


        removeContextMenu();

    },

    true

);


/*
============================================================
DOCUMENT CONTEXT MENU
============================================================

Right-click anywhere else on the webpage.

Close our custom menu.

============================================================
*/

document.addEventListener(

    "contextmenu",

    event => {

        if (

            event.target instanceof Element &&

            event.target.closest(

                ".manual-tester-highlight"

            )

        ) {

            return;

        }


        removeContextMenu();

    },

    true

);


/*
============================================================
POPUP MESSAGES
============================================================

Commands supported:

    SET_ENABLED

    SET_COLOR

    SET_SELECTOR_TYPE

    CLEAR_HIGHLIGHTS

============================================================
*/

chrome.runtime.onMessage.addListener(

    message => {

        if (

            !message ||

            typeof message.type !==
            "string"

        ) {

            return;

        }


        /*
        ====================================================
        ENABLE / DISABLE
        ====================================================
        */

        if (

            message.type ===
            "SET_ENABLED"

        ) {

            enabled =
                Boolean(
                    message.enabled
                );


            if (!enabled) {

                cancelDrawing();

                removeLayer();

                return;

            }


            loadHighlights()

                .then(

                    () => {

                        renderHighlights();

                    }

                )

                .catch(

                    console.error

                );


            return;

        }


        /*
        ====================================================
        COLOR
        ====================================================
        */

        if (

            message.type ===
            "SET_COLOR"

        ) {

            if (

                VALID_COLORS.has(
                    message.color
                )

            ) {

                selectedColor =
                    message.color;

            }


            return;

        }


        /*
        ====================================================
        SELECTOR TYPE
        ====================================================
        */

        if (

            message.type ===
            "SET_SELECTOR_TYPE"

        ) {

            if (

                VALID_SELECTOR_TYPES.has(
                    message.selectorType
                )

            ) {

                selectorType =
                    message.selectorType;

            }


            return;

        }


        /*
        ====================================================
        CLEAR ALL HIGHLIGHTS
        ====================================================
        */

        if (

            message.type ===
            "CLEAR_HIGHLIGHTS"

        ) {

            /*
            ------------------------------------------------
            STEP 1
            ------------------------------------------------

            Clear the in-memory collection.

            ------------------------------------------------
            */

            highlights = [];


            /*
            ------------------------------------------------
            STEP 2
            ------------------------------------------------

            Remove active tooltip.

            ------------------------------------------------
            */

            removeActiveTooltip();


            /*
            ------------------------------------------------
            STEP 3
            ------------------------------------------------

            Remove custom context menu.

            ------------------------------------------------
            */

            removeContextMenu();


            /*
            ------------------------------------------------
            STEP 4
            ------------------------------------------------

            Remove visible highlight rectangles
            immediately.

            ------------------------------------------------
            */

            if (layer) {

                const visuals =
                    layer.querySelectorAll(

                        ".manual-tester-highlight"

                    );


                visuals.forEach(

                    visual => {

                        visual.remove();

                    }

                );

            }


            /*
            ------------------------------------------------
            STEP 5
            ------------------------------------------------

            Save empty array to Chrome storage.

            This is CRITICAL.

            Without this, old highlights would
            return after refresh.

            ------------------------------------------------
            */

            saveHighlights()

                .then(

                    () => {

                        /*
                        Re-render after storage
                        has been updated.
                        */

                        renderHighlights();

                    }

                )

                .catch(

                    error => {

                        console.error(

                            "Failed to clear all highlights:",

                            error

                        );


                        /*
                        Keep UI cleared even if
                        storage operation fails.
                        */

                        renderHighlights();

                    }

                );


            return;

        }

    }

);


/*
============================================================
STORAGE CHANGE LISTENER
============================================================

Keeps content script synchronized with popup
and other extension pages.

============================================================
*/

chrome.storage.onChanged.addListener(

    async (
        changes,
        areaName
    ) => {

        if (

            areaName !==
            "local"

        ) {

            return;

        }


        /*
        ====================================================
        ENABLED
        ====================================================
        */

        if (
            changes.enabled
        ) {

            enabled =
                Boolean(
                    changes.enabled.newValue
                );


            if (!enabled) {

                cancelDrawing();

                removeLayer();

            } else {

                await loadHighlights();

                renderHighlights();

            }

        }


        /*
        ====================================================
        COLOR
        ====================================================
        */

        if (
            changes.selectedColor
        ) {

            const color =
                changes.selectedColor.newValue;


            if (
                VALID_COLORS.has(
                    color
                )
            ) {

                selectedColor =
                    color;

            }

        }


        /*
        ====================================================
        SELECTOR TYPE
        ====================================================
        */

        if (
            changes.selectorType
        ) {

            const type =
                changes.selectorType.newValue;


            if (
                VALID_SELECTOR_TYPES.has(
                    type
                )
            ) {

                selectorType =
                    type;

            }

        }


        /*
        ====================================================
        HIGHLIGHTS
        ====================================================
        */

        if (
            changes.highlights
        ) {

            await loadHighlights();

            renderHighlights();

        }

    }

);


/*
============================================================
DOM MUTATION OBSERVER
============================================================

Web applications such as:

    React
    Angular
    Vue

frequently change the DOM.

When a webpage component moves or gets recreated,
we resolve its selector again.

The extension's own DOM mutations are ignored.

============================================================
*/

function observeDOMChanges() {

    if (mutationObserver) {

        mutationObserver.disconnect();

    }


    mutationObserver =
        new MutationObserver(

            mutations => {

                let webpageChanged = false;


                for (
                    const mutation
                    of mutations
                ) {

                    /*
                    Ignore mutations created
                    by our extension.
                    */

                    if (
                        isExtensionMutation(
                            mutation
                        )
                    ) {

                        continue;

                    }


                    webpageChanged = true;

                    break;

                }


                if (
                    webpageChanged
                ) {

                    scheduleRender();

                }

            }

        );


    mutationObserver.observe(

        document.documentElement,

        {

            childList:
                true,

            subtree:
                true,

            attributes:
                true,

            attributeFilter: [

                "id",

                "class",

                "style",

                "hidden"

            ]

        }

    );

}


/*
============================================================
INITIALIZE
============================================================
*/

async function initialize() {

    await loadSettings();

    await loadHighlights();

    observeDOMChanges();


    if (enabled) {

        renderHighlights();

    }

}


/*
============================================================
START EXTENSION
============================================================
*/

initialize()

    .catch(

        error => {

            console.error(

                "Manual Tester Highlighter initialization failed.",

                error

            );

        }

    );