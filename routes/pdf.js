var express = require('express')
var router = express.Router()
const fs = require('fs')
const path = require('path')
const http = require("http")
const { promisify } =  require('util')
const hummus = require('hummus')

// NOT USE
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const get = promisify(http.get)

async function fetchFile(url, filename) {
  const file = fs.createWriteStream(`/tmp/${filename}`/*path.join(__dirname, '../tmp', filename)*/)
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      res.pipe(file)
      resolve()
    })
  })
}


async function watermarkPdf(url, filename, company, username) {
  console.log(`origin url: ${url} filename: ${filename} company: ${company} username: ${username}`)
  const filePath = `/tmp/${filename}`//path.join(__dirname, '../tmp', name)
  const outPath = path.join(__dirname, `../output`, filename)

  console.log(outPath)
  console.log(filePath)
  if (!fs.existsSync(filePath)) {
    await fetchFile(url, filename)
  }

  if (fs.existsSync(outPath)) {
    fs.unlinkSync(outPath)
  }

  const pdfReader = hummus.createReader(filePath)
  const pdfWriter = hummus.createWriterToModify(filePath, {
    modifiedFilePath: outPath
  })
  const objCtx = pdfWriter.getObjectsContext()
  const gsId = objCtx.startNewIndirectObject()
  const dict = objCtx.startDictionary()
  dict.writeKey("type")
  dict.writeNameValue("ExtGState")
  dict.writeKey("ca")
  objCtx.writeNumber(0.5)
  objCtx.endLine()
  objCtx.endDictionary(dict)

  const fontHeiti = pdfWriter.getFontForFile(path.join(__dirname, '../fonts/STHeiti Light.ttc'))
  const width = getPageDimensions(pdfWriter, 0).width
  const height = getPageDimensions(pdfWriter, 0).height

  const delta = Math.sqrt((width / 2 * width / 2) / 2)
  const x = width / 2 - delta
  const y = height / 2 - delta

  console.log(width, height)
  console.log(x, y)

  const xobjectForm = pdfWriter.createFormXObject(0, 0, width, width / 2)
  const resourcesDict = xobjectForm.getResourcesDictinary()
  const gsName = resourcesDict.addExtGStateMapping(gsId)

  xobjectForm.getContentContext()
    .q()
    .gs(gsName)
    .BT() // Begin Text
    .k(0, 0, 0, 1) // Set Color (CMYK, 0-1)
    .Tf(fontHeiti, width / 10) // Text font? Font & size?
    .Tm(1, 0, 0, 1, 0, width / 10) // Text Matrix, set to coord 5,20
    .Tj(company) // Show text
    .Tf(fontHeiti, width / parseInt(username.length * 4 / 3)) // Text font? Font & size?
    .Tm(1, 0, 0, 1, 0, 10) // Text Matrix, set to coord 5,5 (to place below previous line)
    .Tj(username) // More text
    .ET() // End Text
    .q() // Push Current Matrix
    .cm(1, 0, 0, 1, 0, 0) // Set Current Matrix - scale to 100% (x and y), translate 0,35
    .Q()
  pdfWriter.endFormXObject(xobjectForm)

  for (let i = 0; i < pdfReader.getPagesCount(); ++i) {
    const pageModifier = new hummus.PDFPageModifier(pdfWriter, i, true)
    const cxt = pageModifier.startContext().getContext()
    cxt.q()
      .cm(1, 0, 0, 1, x, y)
      .cm(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), -Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 0, 0)
      .doXObject(xobjectForm)
      .Q()

    pageModifier.endContext().writePage()
  }
  pdfWriter.end()
}


function getPageDimensions(pdfWriter, pageIndex) {
  const pdfParser = pdfWriter.getModifiedFileParser()
  const pageInfo = pdfParser.parsePage(pageIndex)
  const pageMediaBox = pageInfo.getMediaBox()

  return {
    width: pageMediaBox[2] - pageMediaBox[0],
    height: pageMediaBox[3] - pageMediaBox[1]
  }
}


router.get('/', async (req, res, next) => {
  console.log(req.query)

  const { url, company, username } = req.query
  const filename = url.substring(url.lastIndexOf('/')+1)
  await watermarkPdf(url, filename, company, username)
  res.sendFile(path.join(__dirname, '../output', filename))
})
// watermarkPdf('http://www.africau.edu/images/default/sample.pdf', 'sample.pdf', '蛋壳公寓', 'wangzezhi')
module.exports = router
