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
  //;['‘', '’', '‚', '‘'].forEach((c) => replaceAll(c, "'"))

  if ((s.match(/"/g) || []).length % 2) {
    console.error('Lichý počet uvozovek:\t' + sOrig)
    return s
  }
  /*if ((s.match(/'/g) || []).length % 2) {
    console.error('Lichý počet jednoduchých uvozovek:\t' + sOrig)
    return s
  }*/
  replaceAll('"(.*?)"', '„$1“')
  //replaceAll("'(.*?)'", '‚$1‘')
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
  const COLS = 6
  let cols = COLS
  let rows = response.values
  let res = {days: []}
  res.rooms = rows[0].slice(1)
  rows = rows.slice(1)
  rows.push(['x']) // dummy row to add the last day
  let curDay = {}
  let longest = 0
  for (let r of rows) {
    if (r.length === 0) continue // skip empty rows
    if (/^\d.*/.test(r[0])) { // time segment (starts with a number)
      let curTime = {}
      curTime.events = r.slice(1).map(x => ({name: x}))
      while (curTime.events.length < cols) {
        curTime.events.push({name: ''})
      }

      longest = Math.max(longest, curTime.events.length)
      if (/.*\d$/.test(r[0])) { // ends with a number - no special event
        curTime.timeslot = r[0]
      } else {
        let split = r[0].match(/^([\d:]* - [\d:]*) (.*)$/)
        curTime.timeslot = split[1]
        curTime.specialEvent = split[2]
      }
      curTime.timeslot = curTime.timeslot.replace(/ /g, '<br>')
      if (curTime.specialEvent) {
        let cnt = 0
        for (let i = curTime.events.length - 1; i >= 0; i--) {
          if (curTime.events[i].name.length === 0) {
            cnt++
            if (i === 0 || curTime.events[i - 1].name.length > 0) {
              curTime.events[i].name = curTime.specialEvent
              curTime.events[i].special = true
              curTime.events[i].cols = cnt
              curTime.events.splice(i + 1, cnt - 1)
            }
          } else cnt = 0
        }
      }
      curDay.times.push(curTime)
    } else {
      if (curDay.name !== undefined) {
        res.days.push(curDay)
      }
      curDay = {name: r[0], times: []}
      cols = COLS
      if (r.length > 1) {
        r.splice(0, 1)
        curDay.rooms = r
        cols = curDay.rooms.length
        if(cols < 4) curDay.noCenter = true
      }
    }
  }
  res.days.splice(0, 1) // preskocit stredu
  return res
}

function findID (talks, name) {
  let best = -1000000
  let id = -1
  talks.forEach(talk => {
    let diff = jsdiff.diffChars(name + ' ', talk.speakerName + ' — ' + talk.talkName || '')
    let value = 0
    diff.map((part) => {
      if (part.removed) value--
    // if (!(part.added || part.removed)) value++
    })
    if (value > best) {
      best = value
      id = talk.id
    }
  })
  let diff = jsdiff.diffChars(name + ' ', talks[id].speakerName + ' — ' + talks[id].talkName || '')
  diff.forEach(function (part) {
    var color = part.added ? 'green'
      : part.removed ? 'red' : 'grey'
    process.stderr.write(part.value[color])
  })
  console.log('')
  return id
}

function findIDs (json) {
  for (let i = 0; i < json.days.length; i++) {
    for (let j = 0; j < json.days[i].times.length; j++) {
      if (!json.days[i].times[j].events) continue
      for (let k = 0; k < json.days[i].times[j].events.length; k++) {
        let cur = json.days[i].times[j].events[k]
        if ((!cur.name) || (cur.name === '') || cur.name[0] === '?') {
          json.days[i].times[j].events[k].name = ''
          continue
        }
        if (cur.name === 'Oběd') continue
        let id = findID(json.talks, cur.name)
        
        cur.id = id
        cur.link = true
        cur.speakerName = json.talks[id].speakerName
        if (json.talks[id].talkName) cur.talkName = json.talks[id].talkName
        console.log(cur)

        json.days[i].times[j].events[k] = cur
      }
    }
  }
  return json
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
      json = findIDs(json)
      fs.writeFile('data.json', JSON.stringify(json))
    })
  })
}

main()

// let json = JSON.parse(fs.readFileSync('data.json', 'utf-8'))
// json = findIDs(json)
// fs.writeFile('data_demo.json', JSON.stringify(json))
