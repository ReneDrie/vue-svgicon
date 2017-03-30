#!/usr/bin/env node

/**
 * build svg icon
 * @author Allenice
 * @since 2017-02-17
 */

const fs = require('fs-plus')
const path = require('path')
const Svgo = require('svgo')
const golb = require('glob')
const args = require('yargs')
  .usage('Usage: $0 -s svgSourcePath -t targetPath')
  .demandOption(['s', 't'])
  .describe('s', 'svg file path')
  .describe('t', 'generate icon path')
  .help('help')
  .alias('h', 'help')
  .argv

// svg fle path
let filepath = path.join(process.cwd(), args.s, '**/*.svg')
// generated icon path
let targetPath = path.join(process.cwd(), args.t)

// delete previous icons
fs.removeSync(targetPath)

let svgo = new Svgo({
  plugins: [
    {
      removeStyleElement: true
    },
    {
      removeComments: true
    },
    {
      removeDesc: true
    },
    {
      removeUselessDefs: true
    },
    {
      cleanupIDs: {
        remove: true,
        prefix: 'svgicon-'
      }
    },
    {
      convertShapeToPath: true
    }
  ]
})

// get file path by filename
function getFilePath (filename) {
  let filePath = filename.replace(path.resolve(args.s), '').replace(path.basename(filename), '')
  if (filePath.indexOf('/') === 0) {
    filePath = filePath.substr(1)
  }

  return filePath
}

// generate index.js, which import all icons
function generateIndex(files) {
  let content = ''
  files.forEach((filename) => {
    let name = path.basename(filename).split('.')[0]
    const filePath = getFilePath(filename)
    content += `require('./${filePath}${name}')\n`
  })

  fs.writeFile(path.join(targetPath, 'index.js'), content, 'utf-8', (err) => {
    if (err) {
      console.log(err)
      return false
    }

    console.log('Generated index.js')
  })
}

golb(filepath, function (err, files) {
  if (err) {
    console.log(err)
    return false
  }

  files.forEach((filename, ix) => {
    let name = path.basename(filename).split('.')[0]
    let content = fs.readFileSync(filename, 'utf-8')
    let filePath = getFilePath(filename)

    svgo.optimize(content, (result) => {
      let data = result.data.replace(/<svg[^>]+>/gi, '').replace(/<\/svg>/gi, '')
      let viewBox = result.data.match(/viewBox="([\d\.]+\s[\d\.]+\s[\d\.]+\s[\d\.]+)"/)

      if (viewBox && viewBox.length > 1) {
        viewBox = `'${viewBox[1]}'`
      }

      // add pid attr, for css
      let reg = /<(path|rect|circle|polygon|line|polyline)\s/gi
      let id = 0
      data = data.replace(reg, function (match) {
        return match + `pid="${id++}" `
      })

      let content = `
var icon = require('vue-svgicon')
icon.register({
  '${filePath}${name}': {
    width: ${parseFloat(result.info.width) || 16},
    height: ${parseFloat(result.info.height) || 16},
    viewBox: ${viewBox},
    data: '${data}'
  }
})`
      fs.writeFile(path.join(targetPath, filePath, name + '.js'), content, 'utf-8', function (err) {
        if (ix === files.length - 1) {
          generateIndex(files)
        }
        if (err) {
          console.log(err)
          return false
        }

        console.log(`Generated icon: ${filePath}${name}`)
      })
    })
  })
})

