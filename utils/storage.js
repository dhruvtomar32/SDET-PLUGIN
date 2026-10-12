"use strict";


/*
============================================================
LOCAL STORAGE HELPERS
============================================================

Everything uses:

    chrome.storage.local

Nothing is sent to a server.
============================================================
*/


const STORAGE_KEYS = {

    ENABLED:
        "enabled",

    COLOR:
        "selectedColor",

    SELECTOR_TYPE:
        "selectorType",

    HIGHLIGHTS:
        "highlights"

};


/*
============================================================
GET SETTINGS
============================================================
*/

async function getSettings() {

    const result =
        await chrome.storage.local.get([

            STORAGE_KEYS.ENABLED,

            STORAGE_KEYS.COLOR,

            STORAGE_KEYS.SELECTOR_TYPE

        ]);


    return {

        enabled:
            result[STORAGE_KEYS.ENABLED]
            ?? false,

        selectedColor:
            result[STORAGE_KEYS.COLOR]
            ?? "red",

        selectorType:
            result[STORAGE_KEYS.SELECTOR_TYPE]
            ?? "id"

    };

}


/*
============================================================
GET ALL HIGHLIGHTS
============================================================
*/

async function getAllHighlights() {

    const result =
        await chrome.storage.local.get([

            STORAGE_KEYS.HIGHLIGHTS

        ]);


    return (
        result[STORAGE_KEYS.HIGHLIGHTS]
        || {}
    );

}


/*
============================================================
GET PAGE HIGHLIGHTS
============================================================
*/

async function getPageHighlights(
    pageKey
) {

    const all =
        await getAllHighlights();


    return (
        all[pageKey]
        || []
    );

}


/*
============================================================
SAVE PAGE HIGHLIGHTS
============================================================
*/

async function savePageHighlights(
    pageKey,
    pageHighlights
) {

    const all =
        await getAllHighlights();


    all[pageKey] =
        pageHighlights;


    await chrome.storage.local.set({

        [STORAGE_KEYS.HIGHLIGHTS]:
            all

    });

}


/*
============================================================
DELETE PAGE HIGHLIGHTS
============================================================
*/

async function deletePageHighlights(
    pageKey
) {

    const all =
        await getAllHighlights();


    delete all[pageKey];


    await chrome.storage.local.set({

        [STORAGE_KEYS.HIGHLIGHTS]:
            all

    });

}