"use strict";


/*
============================================================
MANUAL TESTER HIGHLIGHTER
BACKGROUND SERVICE WORKER
============================================================
*/


const DEFAULT_SETTINGS = {

    enabled:
        false,

    selectedColor:
        "red",

    selectorType:
        "id",

    highlights:
        {}

};


/*
============================================================
INSTALLATION
============================================================
*/

chrome.runtime.onInstalled.addListener(
    async () => {

        const existing =
            await chrome.storage.local.get(
                Object.keys(
                    DEFAULT_SETTINGS
                )
            );


        const missing = {};


        for (
            const [
                key,
                value
            ]
            of Object.entries(
                DEFAULT_SETTINGS
            )
        ) {

            if (
                typeof existing[key] ===
                "undefined"
            ) {

                missing[key] =
                    value;

            }

        }


        if (
            Object.keys(missing).length > 0
        ) {

            await chrome.storage.local.set(
                missing
            );

        }

    }
);