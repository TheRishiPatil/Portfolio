function startSkillAnimation() {
    let skills = document.querySelectorAll(".skill");
    let targetPercentages = [65, 65, 60, 70, 65, 60];

    skills.forEach((skill, index) => {
        let progress = skill.querySelector(".progress");
        let progressValue = skill.querySelector(".percentage");

        let progressStartValue = 0;
        let progressEndValue = targetPercentages[index];
        let speed = 50;

        let currProgress = setInterval(() => {
            progressStartValue++;
            progressValue.textContent = `${progressStartValue}%`;
            progress.style.background = `conic-gradient(#10A9F5 ${progressStartValue * 3.6}deg, #0D0D10 0deg)`

            if (progressStartValue === progressEndValue) {
                clearInterval(currProgress);
            }
        }, speed);
    });
}

let skillsContainer = document.querySelector(".Skills");

let observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            startSkillAnimation();
            observer.unobserve(skillsContainer);
        }
    });
});

observer.observe(skillsContainer);
