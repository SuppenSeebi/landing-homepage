/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ TOP: Textupdater ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const dynamicTextContentDiv = document.getElementById("top-text-content");
const dynamicTextPreembleDiv = document.getElementById("top-text-preemble");

function updateTopMeText(newPreemble, newContent) {
    dynamicTextPreembleDiv.innerHTML = newPreemble;
    dynamicTextContentDiv.innerHTML = '<i class="bi bi-caret-right-fill"></i> ' + newContent;
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ TOP: slide Image in and out ~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

function slideImageIn(imgId) {
    var img = document.getElementById(imgId);
    if (!img) return;

    console.log(img);
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
   ~~ TOP: Handling of Scrolling ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
let lastScrollTop = -1
let currentSection = 0;
const contentHeightFactor = 4
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

    const intervalHeight = window.innerHeight / contentHeightFactor;
    const newSection = Math.floor(scrollY / intervalHeight) % content.length;

    if (newSection !== currentSection) {
        updateTopMeText(content[newSection].preemble, content[newSection].text);
        if (content[currentSection].imageId !== content[newSection].imageId) {
            slideImageIn(content[newSection].imageId);
            slideImageOut(content[currentSection].imageId);
        }
    }

    currentSection = newSection;
    lastScrollTop = scrollY <= 0 ? 0 : scrollY; /* iOS Bounce Fix */
}