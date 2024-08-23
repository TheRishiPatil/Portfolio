const showPopupButton = document.getElementById("showPopup");
const closePopupButton = document.getElementById("closePopup");
const popupForm = document.getElementById("popupForm");
const overlay = document.getElementById("overlay");

showPopupButton.addEventListener("click", function () {
    popupForm.style.display = "block";
    overlay.style.display = "block";
});

closePopupButton.addEventListener("click", function () {
    popupForm.style.display = "none";
    overlay.style.display = "none";
});