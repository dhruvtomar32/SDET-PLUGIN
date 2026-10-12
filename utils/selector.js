"use strict";


/*
============================================================
SELECTOR UTILITIES
============================================================

Supports:

    ID
    CSS
    XPath

A selector is accepted only when it uniquely identifies
the intended DOM element.

============================================================
*/


const SELECTOR_TYPES = Object.freeze({

    ID: "id",

    CSS: "css",

    XPATH: "xpath"

});


/*
============================================================
CSS ESCAPE
============================================================
*/

function cssEscape(value) {

    if (
        typeof CSS !== "undefined" &&
        typeof CSS.escape === "function"
    ) {

        return CSS.escape(value);

    }


    return String(value).replace(

        /([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,

        "\\$1"

    );

}


/*
============================================================
XPATH STRING LITERAL
============================================================

Correctly handles:

    normal strings
    strings containing '
    strings containing "
    strings containing both
============================================================
*/

function xpathLiteral(value) {

    const stringValue =
        String(value);


    if (
        !stringValue.includes("'")
    ) {

        return `'${stringValue}'`;

    }


    if (
        !stringValue.includes('"')
    ) {

        return `"${stringValue}"`;

    }


    const parts =
        stringValue.split("'");


    const result = [];


    parts.forEach(
        (part, index) => {

            if (part.length > 0) {

                result.push(
                    `'${part}'`
                );

            }


            if (
                index <
                parts.length - 1
            ) {

                result.push(
                    `"'"`

                );

            }

        }
    );


    return (
        "concat(" +
        result.join(", ") +
        ")"
    );

}


/*
============================================================
FIND ELEMENT USING XPATH
============================================================
*/

function getElementByXPath(
    xpath,
    root = document
) {

    try {

        const result =
            root.evaluate(

                xpath,

                root,

                null,

                XPathResult.FIRST_ORDERED_NODE_TYPE,

                null

            );


        return (
            result.singleNodeValue
            instanceof Element
        )
            ? result.singleNodeValue
            : null;

    } catch {

        return null;

    }

}


/*
============================================================
GENERATE XPATH
============================================================
*/

function getXPath(element) {

    if (
        !(element instanceof Element)
    ) {

        return null;

    }


    /*
    Prefer ID when creating XPath.

    Example:

        //*[@id='login']
    */

    if (element.id) {

        return (
            `//*[@id=${xpathLiteral(element.id)}]`
        );

    }


    const parts = [];

    let current = element;


    while (
        current instanceof Element
    ) {

        const tagName =
            current.tagName.toLowerCase();


        let index = 1;


        let sibling =
            current.previousElementSibling;


        while (sibling) {

            if (
                sibling.tagName ===
                current.tagName
            ) {

                index++;

            }


            sibling =
                sibling.previousElementSibling;

        }


        parts.unshift(

            `${tagName}[${index}]`

        );


        if (
            current ===
            document.documentElement
        ) {

            break;

        }


        current =
            current.parentElement;

    }


    return (
        "/" +
        parts.join("/")
    );

}


/*
============================================================
CHECK CSS SELECTOR UNIQUENESS
============================================================
*/

function isUniqueCSS(
    selector,
    expectedElement
) {

    try {

        const matches =
            document.querySelectorAll(
                selector
            );


        return (
            matches.length === 1 &&
            matches[0] ===
            expectedElement
        );

    } catch {

        return false;

    }

}


/*
============================================================
CHECK XPATH UNIQUENESS
============================================================
*/

function isUniqueXPath(
    xpath,
    expectedElement
) {

    return (
        getElementByXPath(xpath) ===
        expectedElement
    );

}


/*
============================================================
ID SELECTOR
============================================================
*/

function getUniqueIdSelector(
    element
) {

    if (
        !(element instanceof Element)
    ) {

        return null;

    }


    if (!element.id) {

        return null;

    }


    const selector =
        `#${cssEscape(element.id)}`;


    if (
        isUniqueCSS(
            selector,
            element
        )
    ) {

        return selector;

    }


    return null;

}


/*
============================================================
CSS SELECTOR
============================================================
*/

function getUniqueCSSSelector(
    element
) {

    if (
        !(element instanceof Element)
    ) {

        return null;

    }


    /*
    First try unique ID.
    */

    const idSelector =
        getUniqueIdSelector(
            element
        );


    if (idSelector) {

        return idSelector;

    }


    /*
    Try tag + classes.
    */

    const classes =
        Array.from(
            element.classList
        )
        .filter(
            className =>
                className.trim().length > 0
        )
        .map(
            className =>
                cssEscape(className)
        );


    if (
        classes.length > 0
    ) {

        const classSelector =
            `${element.tagName.toLowerCase()}.` +
            classes.join(".");


        if (
            isUniqueCSS(
                classSelector,
                element
            )
        ) {

            return classSelector;

        }

    }


    /*
    Build structural selector.
    */

    const path = [];

    let current = element;


    while (

        current instanceof Element &&

        current !== document.body &&

        current !== document.documentElement

    ) {

        let part =
            current.tagName.toLowerCase();


        const currentClasses =
            Array.from(
                current.classList
            )
            .filter(
                className =>
                    className.trim().length > 0
            )
            .slice(0, 2)
            .map(
                className =>
                    cssEscape(className)
            );


        if (
            currentClasses.length > 0
        ) {

            part +=
                "." +
                currentClasses.join(".");

        }


        const parent =
            current.parentElement;


        if (parent) {

            const sameTagSiblings =
                Array.from(
                    parent.children
                )
                .filter(
                    child =>
                        child.tagName ===
                        current.tagName
                );


            if (
                sameTagSiblings.length > 1
            ) {

                const position =
                    sameTagSiblings.indexOf(
                        current
                    ) + 1;


                part +=
                    `:nth-of-type(${position})`;

            }

        }


        path.unshift(part);


        const candidate =
            path.join(" > ");


        if (
            isUniqueCSS(
                candidate,
                element
            )
        ) {

            return candidate;

        }


        current =
            current.parentElement;

    }


    /*
    Last attempt: direct body path.
    */

    if (element.parentElement) {

        const pathWithBody = [];

        current = element;


        while (
            current instanceof Element &&
            current !== document.body
        ) {

            let part =
                current.tagName.toLowerCase();


            const parent =
                current.parentElement;


            if (parent) {

                const siblings =
                    Array.from(
                        parent.children
                    )
                    .filter(
                        child =>
                            child.tagName ===
                            current.tagName
                    );


                if (
                    siblings.length > 1
                ) {

                    part +=
                        `:nth-of-type(${
                            siblings.indexOf(current) + 1
                        })`;

                }

            }


            pathWithBody.unshift(
                part
            );


            current =
                current.parentElement;

        }


        const bodyCandidate =
            "body > " +
            pathWithBody.join(" > ");


        if (
            isUniqueCSS(
                bodyCandidate,
                element
            )
        ) {

            return bodyCandidate;

        }

    }


    return null;

}


/*
============================================================
SELECTOR FOR ELEMENT
============================================================
*/

function getSelectorForElement(
    element,
    selectorType
) {

    if (
        !(element instanceof Element)
    ) {

        return null;

    }


    switch (selectorType) {


        case SELECTOR_TYPES.ID:

            return getUniqueIdSelector(
                element
            );


        case SELECTOR_TYPES.CSS:

            return getUniqueCSSSelector(
                element
            );


        case SELECTOR_TYPES.XPATH: {

            const xpath =
                getXPath(element);


            if (
                xpath &&
                isUniqueXPath(
                    xpath,
                    element
                )
            ) {

                return xpath;

            }


            return null;

        }


        default:

            return null;

    }

}


/*
============================================================
RESOLVE STORED SELECTOR
============================================================
*/

function resolveSelector(
    selectorType,
    selector
) {

    if (!selector) {

        return null;

    }


    if (
        selectorType ===
        SELECTOR_TYPES.XPATH
    ) {

        return getElementByXPath(
            selector
        );

    }


    if (

        selectorType ===
        SELECTOR_TYPES.ID ||

        selectorType ===
        SELECTOR_TYPES.CSS

    ) {

        try {

            const element =
                document.querySelector(
                    selector
                );


            return (
                element instanceof Element
            )
                ? element
                : null;

        } catch {

            return null;

        }

    }


    return null;

}