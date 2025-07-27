/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ TOP: Textupdater ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const dynamicTextContentDiv = document.getElementById("top-text-content");
const dynamicTextPreembleDiv = document.getElementById("top-text-preemble");

function updateTopMeText(newPreemble, newContent) {
    dynamicTextPreembleDiv.innerHTML = newPreemble;
    scramblePartialText(dynamicTextContentDiv, '<i class="bi bi-caret-right-fill"></i> ' + newContent);
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ TOP: slide Image in and out ~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

function slideImageIn(imgId) {
    var img = document.getElementById(imgId);
    if (!img) return;

    img.classList.remove('slide-out');
    img.classList.add("slide-in");
}

function slideImageOut(imgId) {
    var img = document.getElementById(imgId);
    if (!img) return;

    img.classList.remove('slide-in');
    img.classList.add("slide-out");
}

function slideImageHideAll() {
    const images = document.querySelectorAll('.top-image img');
    images.forEach(img => {
        img.classList.remove('slide-in', 'slide-out');
    });
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ TOP: Text Scrambler ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const randomChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789     ";
const minScrambleLength = 2;
const maxScrambleLength = 5;

function getRandomString(length) {
    return Array.from({ length }, () => randomChars[Math.floor(Math.random() * randomChars.length)]).join("");
}

function scramblePartialText(target, text, revealStartRatio = 0.4, animationDuration = 100, frameDelay = 75) {
    const splitIndex = Math.floor(text.length * revealStartRatio);
    const staticPart = text.slice(0, splitIndex);
    const scramblePart = text.slice(splitIndex);

    let revealed = Array(scramblePart.length).fill(false);
    let display = Array.from(scramblePart);
    let frame = 0;

    const interval = setInterval(() => {
        let doneCount = 0;

        /* Set 2-4 chars per frame */
        const toReveal = Math.floor(Math.random() * 5) + 3;
        let count = 0;

        for (let i = 0; i < scramblePart.length && count < toReveal; i++) {
            if (!revealed[i]) {
                revealed[i] = true;
                count++;
            }
        }

        for (let i = 0; i < scramblePart.length; i++) {
            if (revealed[i]) {
                display[i] = scramblePart[i];
                doneCount++;
            } else {
                const len = Math.floor(Math.random() * (maxScrambleLength - minScrambleLength + 1)) + minScrambleLength;
                display[i] = getRandomString(len)[0];
            }
        }

        target.innerHTML = staticPart + display.join("");

        if (doneCount >= scramblePart.length || frame > animationDuration) {
            clearInterval(interval);
            target.innerHTML = text;
        }

        frame++;
    }, frameDelay);
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ TOP: Define Scroll Height ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const scrollContainer = document.getElementById("scroll-space-top-aboutme");
const mobileIntervals = 250;
const defaultIntervals = 250;

function getIntervalHeight(){
    const isMobile = window.innerWidth <= 768;
    return isMobile ? mobileIntervals : defaultIntervals;
}

function setScrollHeight() {
    const totalHeight = getIntervalHeight() * content.length;

    scrollContainer.style.height = `${totalHeight}px`;
}
window.addEventListener("load", setScrollHeight);
window.addEventListener("resize", setScrollHeight);

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ TOP: Handling of Scrolling ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
let currentSection = 0;
const contentHeightFactor = 6;
const content = [{
    preemble: "I am",
    text: "Sebastian",
    imageId: "top-me"
},
{
    preemble: "I have",
    text: "a Master with distinction in Electrical Engineering",
    imageId: "top-mealie"
},
{
    preemble: "I am",
    text: "proficient in Embedded Software Engineering, specifically in C and C++ ",
    imageId: "top-kb"
},
{
    preemble: "I also know",
    text: "Python and other languages",
    imageId: "top-todo"
},
{
    preemble: "I also do ",
    text: "3D printing",
    imageId: "top-todo"
},
];

export function statemachineTopRun() {
    let scrollY = window.scrollY;

    const newSection = Math.floor(scrollY / getIntervalHeight()) % content.length;

    if (newSection !== currentSection) {
        updateTopMeText(content[newSection].preemble, content[newSection].text);
        if (content[currentSection].imageId !== content[newSection].imageId) {
            slideImageIn(content[newSection].imageId);
            slideImageOut(content[currentSection].imageId);
        }
    }

    currentSection = newSection;
}