'use strict'
var fs = require('fs')
var markdown = require('markdown').markdown
require('colors')
var jsdiff = require('diff')
var sheets = require('./sheets.js')

var setReq

function checkText (s, positionHint, cell) {
  if (!s) return ''
  let sOrig = s
  let replaceAll = (from, to) => {
    s = s.replace(new RegExp(from, 'g'), to)
  }
  replaceAll('\b  +\b', ' ')
  if (s !== sOrig) {
    console.error('Odstraněny dvojité mezery.')
  }
  ['“', '”', '„', '“', '´´'].forEach((c) => replaceAll(c, '"'))
  ;['‘', '’', '‚', '‘'].forEach((c) => replaceAll(c, "'"))

  if ((s.match(/"/g) || []).length % 2) {
    console.error('Lichý počet uvozovek:\t' + sOrig)
    return s
  }
  if ((s.match(/'/g) || []).length % 2) {
    console.error('Lichý počet jednoduchých uvozovek:\t' + sOrig)
    return s
  }
  replaceAll('"(.*?)"', '„$1“')
  replaceAll("'(.*?)'", '‚$1‘')
  replaceAll(' - ', ' – ') // en dash
  replaceAll('\\.\\.\\.', '…') // ellipsis
  replaceAll('[ \\n]$', '')

  if (s !== sOrig) {
    console.log('Navrhované změny - ' + positionHint + ' (' + cell + '):')
    let diff = jsdiff.diffChars(sOrig + '$', s + '$')
    diff.forEach(function (part) {
      var color = part.added ? 'green'
        : part.removed ? 'red' : 'grey'
      process.stderr.write(part.value[color])
    })
    console.log('\n' + s + '\n')
    setReq(cell, s)
  }
  return s
}

function formatText (s, positionHint, cell) {
  s = checkText(s, positionHint, cell)
  s = markdown.toHTML(s)
  return s
}

function parseDetails (response) {
  var rows = response.values
  let talks = rows.map((row, i) => {
    let speaker = {
      shortName: row[0],
      fullName: row[1],
      description: formatText(row[2], row[0], 'C' + (i + 5))
    }
    return {
      speakers: [speaker],
      talkName: row[3],
      description: formatText(row[4], row[0], 'E' + (i + 5))
    }
  })

  let result = {talks: []}
  for (let i = 0; i < talks.length; i++) {
    let multi = false
    if (typeof talks[i].talkName !== 'undefined') {
      for (let j = 0; j < result.talks.length; j++) {
        if (result.talks[j].talkName === talks[i].talkName) {
          multi = true
          result.talks[j].description += talks[i].description
          result.talks[j].speakers.push(talks[i].speakers[0]) // always only one
          break
        }
      }
    }
    if (!multi) result.talks.push(talks[i])
  }

  for (let i = 0; i < result.talks.length; i++) {
    result.talks[i].id = i
    result.talks[i].speakerName = result.talks[i].speakers
      .map(a => a.shortName)
      .reduce((a, b) => a + ', ' + b)
  }
  return result
}

function parseHarmonogram (response) {
  let rows = response.values
  let res = {days: []}
  res.rooms = rows[0].slice(1)
  rows = rows.slice(1)
  rows.push([['x']]) // dummy row to add the last day
  let curDay = {}
  let longest = 0
  for (let r of rows) {
    if (r.length === 0) continue // skip empty rows
    if (/^\d.*/.test(r[0])) { // time segment (starts with a number)
      let curTime = {}
      if (/.*\d$/.test(r[0])) {
        curTime.timeslot = r[0]
        curTime.events = r.slice(1)
        longest = Math.max(longest, curTime.events.length)
      } else {
        curTime.timeslot = r[0].substring(0, r[0].lastIndexOf(' '))
        curTime.specialEvent = r[0].substring(r[0].lastIndexOf(' ') + 1)
      }
      curTime.timeslot = curTime.timeslot.replace(/ /g, '<br>')
      curDay.times.push(curTime)
    } else {
      if (curDay.name !== undefined) {
        res.days.push(curDay)
      }
      curDay = {name: r[0], times: []}
    }
  }
  for (let d of res.days) {
    for (let t of d.times) {
      if (t.events !== undefined) {
        while (t.events.length < longest) t.events.push('')
      }
    }
  }
  // res.rows = rows
  return res
}

function main () {
  sheets.read((getRequest, setRequest) => {
    setReq = setRequest
    var promises = [
      getRequest('H5 - Medailony a anotace!A5:E', parseDetails),
      getRequest('H1 - Harmonogram!A2:H', parseHarmonogram)
    ]
    Promise.all(promises).then((res) => {
      let json = {}
      for (let i = 0; i < res.length; i++) {
        for (let key in res[i]) {
          json[key] = res[i][key]
        }
      }
      // console.dir(json, {depth: null})
      fs.writeFile('data.json', JSON.stringify(json))
    })
  })
}

main()
