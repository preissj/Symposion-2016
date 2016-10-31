'use strict'
var fs = require('fs')
var readline = require('readline')
var google = require('googleapis')
var googleAuth = require('google-auth-library')
var markdown = require('markdown').markdown
require('colors')
var jsdiff = require('diff')

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/'
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-symp16-scrape.json'

// Load client secrets from a local file.
function main () {
  fs.readFile('client_secret.json', function processClientSecrets (err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err)
      return
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Sheets API.
    authorize(JSON.parse(content), scrape)
  })
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize (credentials, callback) {
  var clientSecret = credentials.installed.client_secret
  var clientId = credentials.installed.client_id
  var redirectUrl = credentials.installed.redirect_uris[0]
  var auth = new googleAuth()
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl)

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback)
    } else {
      oauth2Client.credentials = JSON.parse(token)
      callback(oauth2Client)
    }
  })
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken (oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  })
  console.log('Authorize this app by visiting this url: ', authUrl)
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question('Enter the code from that page here: ', function (code) {
    rl.close()
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err)
        return
      }
      oauth2Client.credentials = token
      storeToken(token)
      callback(oauth2Client)
    })
  })
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken (token) {
  try {
    fs.mkdirSync(TOKEN_DIR)
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token))
  console.log('Token stored to ' + TOKEN_PATH)
}

// var test = 'Vysokoškolský učitel, působící na Právnické fakultě Univerzity Karlovy. Profesor římského práva. Vedoucí katedry právních dějin a proděkan pro profesorské a habilitační řízení a pro rozvoj fakulty. Člen mnoha redakčních rad právněhistorických časopisů v ČR i zahraničí (např. Právník, Právněhistorické studie, Ius Aantiquum (Moskva), Zeszyty prawnicze (Warszawa), Fundamina (Pretoria). Autor učebnice římského práva “Římské právo soukromé. Systém a instituce” a několika monografií s tématikou římského práva (např. "Ius publicum – iius privatum. Vzájemné vztahy a souvislosti”, “Poodkryté tváře římského práva”, "Ius et religio. Právo a náboženství ve starověkém Římě”). Zabývá se zejména vztahem římského práva k platnému občanskému právu, římským trestním právem a překlady římskoprávních textů do češtiny.'

function checkText (s) {
  let sOrig = s
  let replaceAll = (from, to) => {
    s = s.replace(new RegExp(from, 'g'), to)
  }
  replaceAll('  ', ' ')
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

  /*
  var bad = (s.match(/[\.?!,][^ ]| [\.?!,]/g) || [])
  if (bad.length) {
    console.error('Podezřelé mezery:')
    console.dir(bad)
    console.log(s)
  }
  */

  if (s !== sOrig) {
    console.log('Navrhované změny:')
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

function formatText (s) {
  s = checkText(s)
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
      speakerDescription: formatText(row[2]),
      talkName: row[3],
      talkDescription: formatText(row[4])
    }
  })
  for(var i = 0; i < result.speakers.length; i++) {
    result.speakers[i].id = i;
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

function scrape (auth) {
  var id = fs.readFileSync('sheetID.txt')
  var sheets = google.sheets('v4')

  let apiRequest = (range, action) => {
    return new Promise((resolve, reject) => {
      sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: id,
        range: range
      }, (err, response) => {
        if (err) {
          console.log('The API returned an error: ' + err)
          reject(err)
        }
        resolve(action(response))
      })
    })
  }
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
}

main()
