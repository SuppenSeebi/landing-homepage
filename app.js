/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ Common Variables ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const navBoxes = document.querySelectorAll('.nav-box');
const sections = document.querySelectorAll('section');
const logo = document.querySelector('.logo-wrapper');

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
function onScroll() {
    const currentSectionId = getCurrentActionId();

    /* Default: Logo is expected to be top and each box is in its default state.
     * Evaluate all boxes and update them accordingly */
    logo.classList.add('top');
    navBoxes.forEach(box => {
        box.classList.remove('active', 'top');

        /* If this is the current nav activate the box */
        if (box.getAttribute('href') === '#' + currentSectionId) {
            box.classList.add('active');
        }
        /* If box is top and current is not top, then update top box and logo */
        if ((box.getAttribute('href') === '#top') &&
            ('#' + currentSectionId !== '#top')) {
                box.classList.add('top');
                logo.classList.remove('top');
        }
    });
}

window.addEventListener('scroll', onScroll);
window.addEventListener('DOMContentLoaded', onScroll);