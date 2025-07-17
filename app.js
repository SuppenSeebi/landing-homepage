<!-----JavaScript for Toggle Menu-->
var navLinks =document.getElementById("navLinks");
function showMenu(){
    navLinks.style.right="0";
}
function hideMenu(){
    navLinks.style.right="-200px";
}

<!-----JavaScript for Scroll Bar-->
window.addEventListener('scroll', function() {
    const scrollProgress = document.querySelector(".scroll-progress");
    const scrollTop = window.scrollY || window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const scrollable = docHeight - winHeight;
    const scrolled = scrollable > 0 ? (scrollTop / scrollable) * 100 : 0;
    scrollProgress.style.width = scrolled + "%";
});

<!-----Hide the Back To Top Arrow-->
const backToTop = document.querySelector(".back-to-top");

window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
        backToTop.style.display = "block";
    } else {
        backToTop.style.display = "none";
    }
});