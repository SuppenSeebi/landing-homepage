/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ NavBar Coloring ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const navBoxes = document.querySelectorAll('.nav-box');
const sections = document.querySelectorAll('section');
const logo = document.querySelector('.logo-wrapper');

function onScroll() {
    let currentSectionId = 'top'; // Default

    const scrollPos = window.scrollY || window.pageYOffset;

    sections.forEach(section => {
        const offsetTop = section.offsetTop;
        const offsetHeight = section.offsetHeight;

        if (scrollPos >= offsetTop - window.innerHeight / 2 && scrollPos < offsetTop + offsetHeight - window.innerHeight / 2) {
            currentSectionId = section.id;
        }
    });

    // Default: Logo is expected to be top and box is default. Evaluate all boxes and update them accordingly
    logo.classList.add('top');
    navBoxes.forEach(box => {
        box.classList.remove('active', 'top');

        // If this is the current nav. activate the box
        if (box.getAttribute('href') === '#' + currentSectionId) {
            box.classList.add('active');
        }
        // If box is top
        if (box.getAttribute('href') === '#top') {
            // ... and current is not top, then update top box and logo
            if ('#' + currentSectionId !== '#top') {
                box.classList.add('top');
                logo.classList.remove('top');
            }
        }
    });
}

window.addEventListener('scroll', onScroll);
window.addEventListener('DOMContentLoaded', onScroll);