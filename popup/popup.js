"use strict";


const enableToggle =
    document.getElementById(
        "enableToggle"
    );


const statusText =
    document.getElementById(
        "statusText"
    );


const clearButton =
    document.getElementById(
        "clearButton"
    );


const selectorButtons =
    document.querySelectorAll(
        ".selector-button"
    );


const colorButtons =
    document.querySelectorAll(
        ".color-button"
    );


const VALID_SELECTOR_TYPES = [
    "id",
    "css",
    "xpath"
];


const VALID_COLORS = [
    "red",
    "green",
    "blue"
];


/*
============================================================
CURRENT TAB
============================================================
*/

async function getCurrentTab() {

    const tabs =
        await chrome.tabs.query({

            active: true,

            currentWindow: true

        });


    return tabs[0];

}


/*
============================================================
SEND MESSAGE TO CURRENT PAGE
============================================================
*/

async function sendToCurrentTab(
    message
) {

    const tab =
        await getCurrentTab();


    if (
        !tab ||
        typeof tab.id !== "number"
    ) {

        return false;

    }


    try {

        await chrome.tabs.sendMessage(
            tab.id,
            message
        );


        return true;

    } catch (error) {

        /*
        Chrome-owned pages such as:

            chrome://extensions

        do not accept content-script messages.
        */

        console.debug(
            "Current page does not accept extension messages.",
            error
        );


        return false;

    }

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


    const enabled =
        Boolean(
            result.enabled
        );


    const selectedColor =
        VALID_COLORS.includes(
            result.selectedColor
        )
            ? result.selectedColor
            : "red";


    const selectorType =
        VALID_SELECTOR_TYPES.includes(
            result.selectorType
        )
            ? result.selectorType
            : "id";


    enableToggle.checked =
        enabled;


    statusText.textContent =
        enabled
            ? "ON"
            : "OFF";


    selectorButtons.forEach(
        button => {

            button.classList.toggle(

                "selected",

                button.dataset.selectorType ===
                selectorType

            );

        }
    );


    colorButtons.forEach(
        button => {

            button.classList.toggle(

                "selected",

                button.dataset.color ===
                selectedColor

            );

        }
    );

}


/*
============================================================
ENABLE / DISABLE
============================================================
*/

enableToggle.addEventListener(
    "change",
    async () => {

        const enabled =
            enableToggle.checked;


        await chrome.storage.local.set({

            enabled:
                enabled

        });


        statusText.textContent =
            enabled
                ? "ON"
                : "OFF";


        await sendToCurrentTab({

            type:
                "SET_ENABLED",

            enabled:
                enabled

        });

    }
);


/*
============================================================
SELECTOR TYPE
============================================================
*/

selectorButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            async () => {

                const selectorType =
                    button.dataset.selectorType;


                if (
                    !VALID_SELECTOR_TYPES.includes(
                        selectorType
                    )
                ) {

                    return;

                }


                await chrome.storage.local.set({

                    selectorType:
                        selectorType

                });


                selectorButtons.forEach(
                    item => {

                        item.classList.toggle(

                            "selected",

                            item.dataset.selectorType ===
                            selectorType

                        );

                    }
                );


                await sendToCurrentTab({

                    type:
                        "SET_SELECTOR_TYPE",

                    selectorType:
                        selectorType

                });

            }
        );

    }
);


/*
============================================================
COLOR
============================================================
*/

colorButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            async () => {

                const color =
                    button.dataset.color;


                if (
                    !VALID_COLORS.includes(
                        color
                    )
                ) {

                    return;

                }


                await chrome.storage.local.set({

                    selectedColor:
                        color

                });


                colorButtons.forEach(
                    item => {

                        item.classList.toggle(

                            "selected",

                            item.dataset.color ===
                            color

                        );

                    }
                );


                await sendToCurrentTab({

                    type:
                        "SET_COLOR",

                    color:
                        color

                });

            }
        );

    }
);


/*
============================================================
CLEAR HIGHLIGHTS
============================================================
*/

clearButton.addEventListener(
    "click",
    async () => {

        const confirmed =
            window.confirm(
                "Delete all highlights stored for this page?"
            );


        if (!confirmed) {

            return;

        }


        await sendToCurrentTab({

            type:
                "CLEAR_HIGHLIGHTS"

        });

    }
);


/*
============================================================
INITIALIZE
============================================================
*/

loadSettings()
    .catch(
        error => {

            console.error(
                "Unable to load settings.",
                error
            );

        }
    );