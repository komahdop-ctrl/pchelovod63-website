const photos = [...document.querySelectorAll('.photo')]
const lightbox = document.querySelector('.lightbox')
const lightboxImage = lightbox.querySelector('img')
const counter = lightbox.querySelector('p')
let current = 0

function show(index) {
  current = (index + photos.length) % photos.length
  const source = photos[current].querySelector('img')
  lightboxImage.src = source.src
  lightboxImage.alt = source.alt
  counter.textContent = `${current + 1} / ${photos.length}`
  lightbox.hidden = false
  document.body.classList.add('no-scroll')
}

function close() {
  lightbox.hidden = true
  document.body.classList.remove('no-scroll')
}

photos.forEach((photo, index) => photo.addEventListener('click', () => show(index)))
lightbox.querySelector('.close').addEventListener('click', close)
lightbox.querySelector('.prev').addEventListener('click', () => show(current - 1))
lightbox.querySelector('.next').addEventListener('click', () => show(current + 1))
lightbox.addEventListener('click', (event) => { if (event.target === lightbox) close() })
document.addEventListener('keydown', (event) => {
  if (lightbox.hidden) return
  if (event.key === 'Escape') close()
  if (event.key === 'ArrowLeft') show(current - 1)
  if (event.key === 'ArrowRight') show(current + 1)
})
