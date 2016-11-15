'use strict'
/* global requestAnimationFrame */
var PARTICLE_RADIUS = 0.021
var PARTICLE_HITBOX_RADIUS = 0.015
var SAMPLES = 16

var canvas = document.getElementById('sandwichCanvas')
var ctx = canvas.getContext('2d')

function isWhite (x, y) {
  var data = ctx.getImageData(x, y, 1, 1).data
  return data[3] === 0 || (data[0] + data[1] + data[2]) >= 3 * 250
}

var startTime = Date.now()
var update = function () {
  var angle = Math.random() * 2 * Math.PI
  var t = Date.now() - startTime
  var hitboxR = Math.log(t) / 12
  hitboxR *= PARTICLE_HITBOX_RADIUS
  var x = canvas.width / 2 - Math.cos(angle) * canvas.width * 0.7
  var y = canvas.height / 2 - Math.sin(angle) * canvas.width * 0.7
  x += (Math.random() - 0.5) * 20
  y += (Math.random() - 0.5) * 20

  for (var step = 0; step < 400; step++) {
    x += Math.cos(angle)
    y += Math.sin(angle)
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
      continue
    }
    var stop = false
    for (var i = 0; i < SAMPLES; i++) {
      var x1 = x + Math.cos((Math.PI * 2 / SAMPLES) * i) * hitboxR * canvas.width
      var y1 = y + Math.sin((Math.PI * 2 / SAMPLES) * i) * hitboxR * canvas.width
      if (!isWhite(x1, y1)) stop = true
    }
    if (stop) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'red'
      ctx.beginPath()
      ctx.arc(x, y, PARTICLE_RADIUS * canvas.width, 0, Math.PI * 2, false)
      ctx.fill()
      break
    }
  }
  requestAnimationFrame(update)
}

window.onload = function () {
  var sandwich = document.getElementById('down')
  ctx.drawImage(sandwich, 0, 0, canvas.width, canvas.height)
  update()
}
