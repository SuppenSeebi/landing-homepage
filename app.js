import { statemachineTopRun } from './statemachine/statemachine-top.js';
import { statemachineAboutMeRun } from './statemachine/statemachine-aboutme.js';
import { statemachineWorkRun } from './statemachine/statemachine-work.js';
import { statemachineLinksRun } from './statemachine/statemachine-links.js';
import { statemachineImpressumRun } from './statemachine/statemachine-impressum.js';

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ Common Variables ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const navbarBoxes = document.querySelectorAll('.nav-box');
const sections = document.querySelectorAll('section');
const logoWrapper = document.querySelector('.logo-wrapper');

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ Get Current Action ID ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
function getCurrentActionId() {
    let currentSectionId = 'top'; /* Default is top */
    const scrollPos = window.scrollY || window.pageYOffset;
    sections.forEach(section => {
        const offsetTop = section.offsetTop;
        const offsetHeight = section.offsetHeight;

        if (scrollPos >= offsetTop - window.innerHeight / 2 && scrollPos < offsetTop + offsetHeight - window.innerHeight / 2) {
            currentSectionId = section.id;
        }
    });

    return currentSectionId;
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ On Scroll Listener Function ~~~~~~~~~~~~~~~~~~~~~~~~~~~
   - Colors the navbar with "active" and "top"
   - updates the logo position with "top" */
function onScrollMain() {
    const currentSectionId = getCurrentActionId();

    /* Do this always */
    updatelogoWrapper(currentSectionId);
    updateNavbarBoxes(currentSectionId);

    statemachineHandler(currentSectionId);

}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ Statemachine Handler ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
function statemachineHandler(currentSectionId) {
    switch (currentSectionId) {
        case 'top':
            statemachineTopRun();
            break;
        case 'aboutme':
            statemachineAboutMeRun();
            break;
        case 'work':
            statemachineWorkRun();
            break;
        case 'links':
            statemachineLinksRun();
            break;
        case 'impressum':
            statemachineImpressumRun();
            break;
        default:
            break;
    }
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ Update Logo-Position and NavBar ~~~~~~~~~~~~~~~~~~~~~~~
   Default: - Logo is expected to be top and each box is in its default state.
            - Evaluate all boxes and update them accordingly */
function updatelogoWrapper(currentSectionId) {
    if (currentSectionId === 'top') {
        logoWrapper.classList.add('top');
    }
    else {
        logoWrapper.classList.remove('top');
    }
}

function updateNavbarBoxes(currentSectionId) {
    navbarBoxes.forEach(box => {
        box.classList.remove('active', 'top');

        /* If this is the current nav activate the box */
        if (box.getAttribute('href') === '#' + currentSectionId) {
            box.classList.add('active');
        }
        /* If box is top and current is not top, then update top box*/
        if ((box.getAttribute('href') === '#top') &&
            ('#' + currentSectionId !== '#top')) {
            box.classList.add('top');
        }
    });
}

window.addEventListener('scroll', onScrollMain);
window.addEventListener('DOMContentLoaded', onScrollMain);