'use strict'
/* global requestAnimationFrame */
var PARTICLE_RADIUS = 0.021
var PARTICLE_HITBOX_RADIUS = 0.015
var SAMPLES = 16

var BITE_SCALE = 0.0017
var BITE_COLLISION_R = 0.03
var BITE_CHECK_R = 0.1

var loaded = false
var bite = new Image()
bite.onload = function () {
  loaded = true
}
bite.src = 'images/bite.png'

var canvas = document.getElementById('downCanvas')
var ctx = canvas.getContext('2d')
var ucanvas = document.getElementById('upCanvas')
var uctx = ucanvas.getContext('2d')

function isWhite (x, y, canvas, ctx) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return true
  var data = ctx.getImageData(x, y, 1, 1).data
  return data[3] === 0 || (data[0] + data[1] + data[2]) >= 3 * 250
}

function samplesInRadius (x, y, r, samples) {
  if (samples === undefined) samples = SAMPLES
  var res = []
  for (var i = 0; i < SAMPLES; i++) {
    res.push({
      x: x + Math.cos((Math.PI * 2 / samples) * i) * r * canvas.width,
      y: y + Math.sin((Math.PI * 2 / samples) * i) * r * canvas.width
    })
  }
  return res
}

function handleClick (x, y) {
  if (!loaded) return
  var angle = Math.atan2(canvas.height / 2 - y, canvas.width / 2 - x)
  x = canvas.width / 2 - Math.cos(angle) * canvas.width * 1
  y = canvas.height / 2 - Math.sin(angle) * canvas.width * 1

  var stop = false
  for (var step = 0; !stop && step < 2 * canvas.width; step++) {
    x += Math.cos(angle)
    y += Math.sin(angle)
    stop = samplesInRadius(x, y, BITE_COLLISION_R).some(function (pt) {
      return !isWhite(pt.x, pt.y, ucanvas, uctx)
    })
  }

  if (stop) {
    var samples = samplesInRadius(x, y, BITE_CHECK_R)
      .map(function (pt) {
        pt.white = isWhite(pt.x, pt.y, ucanvas, uctx)
        return pt
      })

    var best = samples.map(function (pt) {
      return samples.map(function (pt2) {
        if (pt2.white) return 0
        if (pt.x === pt2.x && pt.y === pt2.y) return 0
        return 1 / (Math.hypot(pt.x - pt2.x, pt.y - pt2.y))
      }).reduce(function (a, b) {
        return a + b
      }, 0)
    }).reduce(function (best, cur, i) {
      if (!cur.white && cur > best.val) {
        return {
          val: cur,
          i: i
        }
      } else return best
    }, {val: -1, i: -1})

    angle = (Math.PI * 2 / SAMPLES) * best.i

    uctx.save()
    uctx.globalCompositeOperation = 'destination-out'
    uctx.translate(x, y)
    uctx.rotate(angle + Math.PI / 2)
    var w = bite.width * canvas.width * BITE_SCALE
    var h = bite.height * canvas.width * BITE_SCALE
    uctx.drawImage(bite, -w / 2, -h / 2, w, h)
    uctx.restore()
    /*
    uctx.fillStyle = 'red'
    uctx.beginPath()
    uctx.arc(x, y, 5, 0, 2 * Math.PI, false)
    uctx.fill()
    samplesInRadius(x, y, BITE_CHECK_R).forEach(function (pt) {
      uctx.fillStyle = 'red'
      uctx.beginPath()
      uctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI, false)
      uctx.fill()
    })
    */
  }
}

ucanvas.addEventListener('click', function (e) {
  var rect = ucanvas.getBoundingClientRect()
  var x = (e.clientX - rect.left) / (rect.right - rect.left) * canvas.width
  var y = (e.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
  handleClick(x, y)
}, false)

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
      if (!isWhite(x1, y1, canvas, ctx)) stop = true
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
  var usandwich = document.getElementById('up')
  uctx.drawImage(usandwich, 0, 0, ucanvas.width, ucanvas.height)
  update()
}
