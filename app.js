/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~ NavBar Coloring ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const navBoxes = document.querySelectorAll('.nav-box');
const sections = document.querySelectorAll('section');

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

    navBoxes.forEach(box => {
        box.classList.remove('active', 'top');
        console.log(currentSectionId)

        // If this is the current nav. activate the box
        if (box.getAttribute('data-section') === currentSectionId) {
            box.classList.add('active');
        }
        // If box is top and current is not top, then update top box
        if((box.getAttribute('data-section') === 'top') && (currentSectionId !== 'top')) {
            box.classList.add('top');
        }
    });
}

window.addEventListener('scroll', onScroll);
window.addEventListener('DOMContentLoaded', onScroll);