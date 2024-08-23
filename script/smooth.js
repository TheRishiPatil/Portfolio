document.addEventListener('DOMContentLoaded', function () {
    const scrollToSection = function (sectionId) {
        if (sectionId === 'top') {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                const offset = targetSection.offsetTop;
                window.scrollTo({
                    top: offset,
                    behavior: 'smooth'
                });
            }
        }
    };

    document.querySelectorAll('.link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = link.getAttribute('href').substring(1);
            scrollToSection(sectionId);
        });
    });
});