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
   ~~ Get Scrolling Direction ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
var lastScrollTop = 0;
var scrollDirection = null;
function updateScrollDirection() {
    var currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (currentScrollTop > lastScrollTop) {
        scrollDirection = 'down';
    } else if (currentScrollTop < lastScrollTop) {
        scrollDirection = 'up';
    }
    else {
        scrollDirection = 'vert';
    }

    lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop; /* For Mobile or negative scrolling */
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ On Scroll Listener Function ~~~~~~~~~~~~~~~~~~~~~~~~~~~
   - Colors the navbar with "active" and "top"
   - updates the logo position with "top" */
function onScrollMain() {
    const currentSectionId = getCurrentActionId();

    /* Do this always */
    updateScrollDirection();
    updatelogoWrapper(currentSectionId);
    updateNavbarBoxes(currentSectionId);

    statemachineHandler(currentSectionId);

}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ Section Transitioning ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
function transitionToSection(sectionId) {
    const next = document.querySelector(`#${sectionId} .section-content-wrapper`);
    const current = document.querySelector('.section-content-wrapper.active');

    next.classList.remove('exit-up', 'exit-down', 'enter-up', 'enter-down', 'active');

    next.classList.add(scrollDirection === 'down' ? 'enter-up' : 'enter-down');

    void next.offsetWidth;

    if (current) {
        current.classList.remove('active');
        current.classList.add(scrollDirection === 'down' ? 'exit-up' : 'exit-down');

        setTimeout(() => {
            current.classList.remove('exit-up', 'exit-down');
        }, 2000);
    }

    next.classList.remove('enter-up', 'enter-down');
    next.classList.add('active');
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ Statemachine Handler ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const sectionStatemachines = new Map();
sectionStatemachines.set('top', statemachineTopRun);
sectionStatemachines.set('aboutme', statemachineAboutMeRun);
sectionStatemachines.set('work', statemachineWorkRun);
sectionStatemachines.set('links', statemachineLinksRun);
sectionStatemachines.set('impressum', statemachineImpressumRun);

let activeSectionId = null;
function statemachineHandler(currentSectionId) {
    if (sectionStatemachines.has(currentSectionId)) {
        if (currentSectionId !== activeSectionId) {
            transitionToSection(currentSectionId);
        }

        sectionStatemachines.get(currentSectionId)();
        activeSectionId = currentSectionId;
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