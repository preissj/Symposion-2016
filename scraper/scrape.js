'use strict'
var fs = require('fs')
var markdown = require('markdown').markdown
require('colors')
var jsdiff = require('diff')
var sheets = require('./sheets.js')

function checkText (s, positionHint) {
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
    console.log('Navrhované změny - ' + positionHint + ':')
    let diff = jsdiff.diffChars(sOrig + '$', s + '$')
    diff.forEach(function (part) {
      var color = part.added ? 'green'
        : part.removed ? 'red' : 'grey'
      process.stderr.write(part.value[color])
    })
    console.log('\n' + s + '\n')
  }
  return s
}

function formatText (s, positionHint) {
  s = checkText(s, positionHint)
  s = markdown.toHTML(s)
  return s
}

function parseDetails (response) {
  var rows = response.values
  let result = {}
  result.speakers = rows.map(row => {
    return {
      shortName: row[0],
      fullName: row[1],
      speakerDescription: formatText(row[2], row[0]),
      talkName: row[3],
      talkDescription: formatText(row[4], row[0])
    }
  })
  for (var i = 0; i < result.speakers.length; i++) {
    result.speakers[i].id = i
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
  sheets.read((apiRequest) => {
    var promises = [
      apiRequest('H5 - Medailony a anotace!A5:E', parseDetails),
      apiRequest('H1 - Harmonogram!A2:H', parseHarmonogram)
    ]
    Promise.all(promises).then((res) => {
      let json = {}
      for (let i = 0; i < res.length; i++) {
        for (let key in res[i]) {
          json[key] = res[i][key]
        }
      }
      // console.dir(json, {depth: null})
      fs.writeFile('data_demo.json', JSON.stringify(json))
    })
  })
}

main()
