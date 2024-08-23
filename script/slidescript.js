document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.next').onclick = function() {
        let lists = document.querySelectorAll('.item');
        document.getElementById('slide').appendChild(lists[0]);
    }

    document.querySelector('.prev').onclick = function() {
        let lists = document.querySelectorAll('.item');
        document.getElementById('slide').prepend(lists[lists.length - 1]);
    }
});