const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('show');
        }
    });
}, {
    threshold: 0.5,
});

const hiddenElements = document.querySelectorAll('.hidden');
hiddenElements.forEach((el) => animationObserver.observe(el));