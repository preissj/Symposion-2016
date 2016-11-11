'use strict'
var BITE_SCALE = 0.0017
var BITE_STEPBACK = BITE_SCALE * 20

var PARTICLE_RADIUS = 8
var PARTICLE_HITBOX_RADIUS = 4
var SAMPLES = 16

var loaded = false
var bite = new Image()
bite.onload = function () {
  loaded = true
}
bite.src = 'images/bite.png'

var canvas = document.getElementById('sandwichCanvas')
var ctx = canvas.getContext('2d')
canvas.width = ctx.canvas.clientWidth
canvas.height = ctx.canvas.clientHeight

var hbCanvas = document.createElement('canvas')
hbCanvas.width = canvas.width
hbCanvas.height = canvas.height
var hbCtx = hbCanvas.getContext('2d')
hbCtx.fillStyle = 'black'
hbCtx.beginPath()
hbCtx.moveTo(50, 200)
hbCtx.lineTo(200, 50)
hbCtx.lineTo(350, 200)
hbCtx.closePath()
hbCtx.fill()

function isWhite (x, y) {
  var data = ctx.getImageData(x, y, 1, 1).data
  return data[3] === 0 || (data[0] + data[1] + data[2]) >= 3 * 250
}

function handleClick (x, y) {
  if (!loaded) return
  var angle = Math.atan2(y - canvas.height / 2, x - canvas.width / 2)
  var ok = true
  if (!isWhite(x, y)) {
    do {
      x += Math.cos(angle)
      y += Math.sin(angle)
      if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
        ok = false
        break
      }
    } while (!isWhite(x, y))
    x += Math.cos(angle) * BITE_STEPBACK * canvas.width
    y += Math.sin(angle) * BITE_STEPBACK * canvas.width
  } else {
    do {
      x -= Math.cos(angle)
      y -= Math.sin(angle)
      if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
        ok = false
        break
      }
      x -= Math.cos(angle) * BITE_STEPBACK * canvas.width
      y = Math.sin(angle) * BITE_STEPBACK * canvas.width
    } while (!isWhite(x, y))
  }
  if (ok) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.translate(x, y)
    ctx.rotate(angle + Math.PI / 2)
    var w = bite.width * canvas.width * BITE_SCALE
    var h = bite.height * canvas.width * BITE_SCALE
    ctx.drawImage(bite, -w / 2, -h / 2, w, h)
    ctx.restore()
    ctx.fillStyle = 'red'
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, 2 * Math.PI, false)
    ctx.fill()
  }
}

canvas.addEventListener('click', function (e) {
  handleClick(e.clientX, e.clientY)
}, false)

var angle = 0
var update = function () {
  angle = Math.random() * 2 * Math.PI
  // angle += 2
  var x = canvas.width / 2 - Math.cos(angle) * canvas.width * 3
  var y = canvas.height / 2 - Math.sin(angle) * canvas.width * 3
  x += (Math.random() - 0.5) * 20
  y += (Math.random() - 0.5) * 20
  for (var step = 0; step < 10000; step++) {
    x += Math.cos(angle)
    y += Math.sin(angle)
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
      continue
    }
    var stop = false
    for (var i = 0; i < SAMPLES; i++) {
      var x1 = x + Math.cos((Math.PI * 2 / SAMPLES) * i) * PARTICLE_HITBOX_RADIUS
      var y1 = y + Math.sin((Math.PI * 2 / SAMPLES) * i) * PARTICLE_HITBOX_RADIUS
      if (!isWhite(x1, y1)) stop = true
    }
    if (stop) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'red'
      ctx.beginPath()
      ctx.arc(x, y, PARTICLE_RADIUS, 0, Math.PI * 2, false)
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
